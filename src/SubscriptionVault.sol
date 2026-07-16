// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface (USDC on Arc is ERC-20 at a fixed address).
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title SubscriptionVault
/// @notice Holds USDC and releases recurring payments on a schedule.
///         An autonomous agent (or the owner) calls pay(id) when a cycle is due.
///         Gas on Arc is paid in USDC, so the agent pays its own gas in USDC.
contract SubscriptionVault {
    // Arc testnet USDC (6 decimals). VERIFY before mainnet deploy.
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    address public owner;
    address public agent;          // authorised to trigger payments
    uint256 public nextId;

    struct Sub {
        address payee;
        uint256 amount;     // per cycle, 6 decimals (e.g. 1 USDC = 1_000_000)
        uint256 interval;   // seconds between cycles
        uint256 cycles;     // total cycles, 0 = infinite
        uint256 paid;       // cycles executed
        uint256 nextDue;    // unix timestamp of next due payment
        bool active;
    }

    mapping(uint256 => Sub) public subs;

    event Subscribed(uint256 id, address payee, uint256 amount, uint256 interval, uint256 cycles);
    event Paid(uint256 id, address payee, uint256 amount, uint256 cycle);
    event Cancelled(uint256 id);

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;
    }

    function setAgent(address _agent) external {
        require(msg.sender == owner, "not owner");
        agent = _agent;
    }

    /// @notice User creates a recurring subscription. Vault must be funded first.
    function subscribe(address payee, uint256 amount, uint256 interval, uint256 cycles)
        external
        returns (uint256 id)
    {
        require(amount > 0 && interval > 0, "bad params");
        id = nextId++;
        subs[id] = Sub({
            payee: payee,
            amount: amount,
            interval: interval,
            cycles: cycles,
            paid: 0,
            nextDue: block.timestamp + interval,
            active: true
        });
        emit Subscribed(id, payee, amount, interval, cycles);
    }

    /// @notice Agent (or owner) executes a due payment. Reverts if not yet due / finished.
    function pay(uint256 id) external {
        require(msg.sender == agent || msg.sender == owner, "not authorized");
        Sub storage s = subs[id];
        require(s.active, "inactive");
        require(block.timestamp >= s.nextDue, "not due");
        require(s.cycles == 0 || s.paid < s.cycles, "finished");

        require(USDC.transfer(s.payee, s.amount), "transfer failed");

        s.paid++;
        s.nextDue += s.interval;
        if (s.cycles != 0 && s.paid >= s.cycles) s.active = false;

        emit Paid(id, s.payee, s.amount, s.paid);
    }

    /// @notice User funds the vault (approve USDC to this contract, then call).
    function fund(uint256 amount) external {
        require(USDC.transferFrom(msg.sender, address(this), amount), "fund failed");
    }

    function cancel(uint256 id) external {
        require(msg.sender == owner, "not owner");
        subs[id].active = false;
        emit Cancelled(id);
    }
}
