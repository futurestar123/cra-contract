// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {AdminTest, ERROR_ONLY_GOVERNOR_OR_STATE_TRANSITION_MANAGER} from "./_Admin_Shared.t.sol";

contract FreezeDiamondTest is AdminTest {
    event Freeze();

    function test_revertWhen_calledByNonGovernorOrStateTransitionManager() public {
        address nonGovernorOrStateTransitionManager = makeAddr("nonGovernorOrStateTransitionManager");

        vm.expectRevert(ERROR_ONLY_GOVERNOR_OR_STATE_TRANSITION_MANAGER);

        vm.startPrank(nonGovernorOrStateTransitionManager);
        adminFacet.freezeDiamond();
    }

    function test_revertWhen_diamondIsAlreadyFrozen() public {
        address governor = adminFacetWrapper.util_getGovernor();

        adminFacetWrapper.util_setIsFrozen(true);

        vm.expectRevert(bytes.concat("a9"));

        vm.startPrank(governor);
        adminFacet.freezeDiamond();
    }

    function test_successfulFreeze() public {
        address governor = adminFacetWrapper.util_getGovernor();

        adminFacetWrapper.util_setIsFrozen(false);

        vm.expectEmit(true, true, true, true, address(adminFacet));
        emit Freeze();

        vm.startPrank(governor);
        adminFacet.freezeDiamond();

        assertEq(adminFacetWrapper.util_getIsFrozen(), true);
    }
}