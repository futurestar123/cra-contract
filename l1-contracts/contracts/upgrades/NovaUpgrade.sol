// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {Diamond} from "../state-transition/libraries/Diamond.sol";
import {BaseZkSyncUpgrade, ProposedUpgrade} from "./BaseZkSyncUpgrade.sol";
import {PubdataPricingMode} from "../state-transition/chain-deps/ZkSyncHyperchainStorage.sol";
import {ETH_TOKEN_ADDRESS} from "../common/Config.sol";

/// @author zk.link
/// @custom:security-contact security@matterlabs.dev
contract NovaUpgrade is BaseZkSyncUpgrade {
    /// @param admin the address of ChainAdmin contract
    /// @param chainId the id of the chain
    /// @param bridgehub the address of the Bridgehub proxy contract
    /// @param stateTransitionManager the address of StateTransactionManager proxy contract
    /// @param baseTokenBridge the address of the L1SharedBridge proxy contract
    /// @param validator the address of VerifierTimelock contract
    struct NovaUpgradeData {
        address admin;
        uint256 chainId;
        address bridgehub;
        address stateTransitionManager;
        address baseTokenBridge;
        address validator;
    }

    /// @notice The main function that will be called by the upgrade proxy.
    /// @param _proposedUpgrade The upgrade to be executed.
    function upgrade(ProposedUpgrade calldata _proposedUpgrade) public override returns (bytes32) {
        super.upgrade(_proposedUpgrade);
        return Diamond.DIAMOND_INIT_SUCCESS_RETURN_VALUE;
    }

    function _postUpgrade(bytes calldata _customCallDataForUpgrade) internal override {
        NovaUpgradeData memory cd = abi.decode(_customCallDataForUpgrade, (NovaUpgradeData));
        s.admin = cd.admin;
        s.feeParams.pubdataPricingMode = PubdataPricingMode.Validium;
        s.validators[cd.validator] = true;
        s.chainId = cd.chainId;
        s.bridgehub = cd.bridgehub;
        s.stateTransitionManager = cd.stateTransitionManager;
        s.baseToken = ETH_TOKEN_ADDRESS;
        s.baseTokenBridge = cd.baseTokenBridge;
        s.baseTokenGasPriceMultiplierNominator = 1;
        s.baseTokenGasPriceMultiplierDenominator = 1;
    }
}
