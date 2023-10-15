// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {ERC20} from '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token is ERC20 {
  constructor(string memory _name) ERC20(_name, _name) {
    _mint(msg.sender, 1000000 * 10 ** decimals());
  }
}
