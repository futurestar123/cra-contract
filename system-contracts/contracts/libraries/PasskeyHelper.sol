// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

address constant REAL_P256VERIFY_CONTRACT_ADDRESS = 0x0000000000000000000000000000000000000100;

//curve order (number of points)
uint256 constant n = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;

uint256 constant P256_N_DIV_2 = n / 2;

struct DecodedWebAuthnSignature {
    uint256 r;
    uint256 s;
    uint8 v;
    bytes authenticatorData;
    bool requireUserVerification;
    string clientDataJSONPrefix;
    string clientDataJSONSuffix;
    uint256 responseTypeLocation;
}

library PasskeyHelper {
    function decodeWebAuthnP256Signature(
        bytes memory _signature
    ) internal pure returns (DecodedWebAuthnSignature memory decodedSig) {
        (
            decodedSig.r,
            decodedSig.s,
            decodedSig.authenticatorData,
            decodedSig.requireUserVerification,
            decodedSig.clientDataJSONPrefix,
            decodedSig.clientDataJSONSuffix,
            decodedSig.responseTypeLocation
        ) = abi.decode(_signature, (uint256, uint256, bytes, bool, string, string, uint256));
    }

    function verifyByP256Contract(
        bytes32 _hash,
        DecodedWebAuthnSignature memory decodedSig,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        bytes memory authenticatorData = decodedSig.authenticatorData;
        bool requireUserVerification = decodedSig.requireUserVerification;
        string memory clientDataJSONPrefix = decodedSig.clientDataJSONPrefix;
        string memory clientDataJSONSuffix = decodedSig.clientDataJSONSuffix;
        bytes memory challenge = abi.encodePacked(_hash);
        uint256 responseTypeLocation = decodedSig.responseTypeLocation;
        uint256 r = decodedSig.r;
        uint256 s = decodedSig.s;

        if (authenticatorData.length < 37 || !checkAuthFlags(authenticatorData[32], requireUserVerification)) {
            return false;
        }

        bytes memory challengeBytes = bytesToHex(challenge);

        bytes memory clientDataJSON = abi.encodePacked(
            clientDataJSONPrefix,
            P256Utils.base64Encode(challengeBytes),
            clientDataJSONSuffix
        );

        // Check that response is for an authentication assertion
        string memory responseType = '"type":"webauthn.get"';
        if (!contains(responseType, string(clientDataJSON), responseTypeLocation)) {
            return false;
        }

        // Check that the public key signed sha256(authenticatorData || sha256(clientDataJSON))
        bytes32 clientDataJSONHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataJSONHash));

        return verifySignature(messageHash, r, s, x, y);
    }

    /**
     *
     * @param message_hash The hash to be verified
     * @param r The r component of the signature
     * @param s The s component of the signature
     * @param x The X coordinate of the public key that signed the message
     * @param y The Y coordinate of the public key that signed the message
     */
    function verifySignature(
        bytes32 message_hash,
        uint256 r,
        uint256 s,
        uint256 x,
        uint256 y
    ) internal view returns (bool) {
        // check for signature malleability
        if (s > P256_N_DIV_2) {
            return false;
        }

        bytes memory args = abi.encode(message_hash, r, s, x, y);

        (bool success, bytes memory ret) = REAL_P256VERIFY_CONTRACT_ADDRESS.staticcall(args);

        if (success) return abi.decode(ret, (bool)) == true;

        return false;
    }

    function bytesToHex(bytes memory data) internal pure returns (bytes memory) {
        bytes memory hexChars = "0123456789abcdef";
        bytes memory str = new bytes(2 + data.length * 2);
        str[0] = "0";
        str[1] = "x";
        for (uint i = 0; i < data.length; i++) {
            str[2 + i * 2] = hexChars[uint8(data[i] >> 4)];
            str[3 + i * 2] = hexChars[uint8(data[i] & 0x0f)];
        }
        return str;
    }

    bytes1 constant AUTH_DATA_FLAGS_UP = 0x01; // Bit 0
    bytes1 constant AUTH_DATA_FLAGS_UV = 0x04; // Bit 2
    bytes1 constant AUTH_DATA_FLAGS_BE = 0x08; // Bit 3
    bytes1 constant AUTH_DATA_FLAGS_BS = 0x10; // Bit 4

    /// Verifies the authFlags in authenticatorData. Numbers in inline comment
    /// correspond to the same numbered bullets in
    /// https://www.w3.org/TR/webauthn-2/#sctn-verifying-assertion.
    function checkAuthFlags(bytes1 flags, bool requireUserVerification) internal pure returns (bool) {
        // 17. Verify that the UP bit of the flags in authData is set.
        if (flags & AUTH_DATA_FLAGS_UP != AUTH_DATA_FLAGS_UP) {
            return false;
        }
        // 18. If user verification was determined to be required, verify that
        // the UV bit of the flags in authData is set. Otherwise, ignore the
        // value of the UV flag.
        if (requireUserVerification && (flags & AUTH_DATA_FLAGS_UV) != AUTH_DATA_FLAGS_UV) {
            return false;
        }

        // 19. If the BE bit of the flags in authData is not set, verify that
        // the BS bit is not set.
        if (flags & AUTH_DATA_FLAGS_BE != AUTH_DATA_FLAGS_BE) {
            if (flags & AUTH_DATA_FLAGS_BS == AUTH_DATA_FLAGS_BS) {
                return false;
            }
        }

        return true;
    }

    function contains(string memory substr, string memory str, uint256 location) internal pure returns (bool) {
        bytes memory substrBytes = bytes(substr);
        bytes memory strBytes = bytes(str);

        uint256 substrLen = substrBytes.length;
        uint256 strLen = strBytes.length;

        for (uint256 i = 0; i < substrLen; i++) {
            if (location + i >= strLen) {
                return false;
            }

            if (substrBytes[i] != strBytes[location + i]) {
                return false;
            }
        }

        return true;
    }
}
