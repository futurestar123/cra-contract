// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

bytes2 constant SINGLE_TX_MAGIC = 0x000a;
bytes2 constant MULTI_TX_MAGIC = 0x000b;

interface IPasskeyBinder {
    function getKey(bytes32 keyIdHash) external view returns (uint256 x_, uint256 y_);
}
