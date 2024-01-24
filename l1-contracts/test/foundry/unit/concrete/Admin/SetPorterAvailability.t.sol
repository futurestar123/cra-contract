// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import {AdminTest, ERROR_ONLY_STATE_TRANSITION_MANAGER} from "./_Admin_Shared.t.sol";

contract SetPorterAvailabilityTest is AdminTest {
    event IsPorterAvailableStatusUpdate(bool isPorterAvailable);

    function test_revertWhen_calledByNonStateTransitionManager() public {
        address nonStateTransitionManager = makeAddr("nonStateTransitionManager");
        bool isPorterAvailable = true;

        vm.expectRevert(ERROR_ONLY_STATE_TRANSITION_MANAGER);

        vm.startPrank(nonStateTransitionManager);
        adminFacet.setPorterAvailability(isPorterAvailable);
    }

    function test_setPorterAvailabilityToFalse() public {
        address stateTransitionManager = adminFacetWrapper.util_getStateTransitionManager();
        bool isPorterAvailable = false;

        adminFacetWrapper.util_setZkPorterAvailability(true);

        vm.expectEmit(true, true, true, true, address(adminFacet));
        emit IsPorterAvailableStatusUpdate(isPorterAvailable);

        vm.startPrank(stateTransitionManager);
        adminFacet.setPorterAvailability(isPorterAvailable);

        assertEq(adminFacetWrapper.util_getZkPorterAvailability(), isPorterAvailable);
    }

    function test_setPorterAvailabilityToTrue() public {
        address stateTransitionManager = adminFacetWrapper.util_getStateTransitionManager();
        bool isPorterAvailable = true;

        adminFacetWrapper.util_setZkPorterAvailability(false);

        vm.expectEmit(true, true, true, true, address(adminFacet));
        emit IsPorterAvailableStatusUpdate(isPorterAvailable);

        vm.startPrank(stateTransitionManager);
        adminFacet.setPorterAvailability(isPorterAvailable);

        assertEq(adminFacetWrapper.util_getZkPorterAvailability(), isPorterAvailable);
    }
}