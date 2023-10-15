// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';

contract Nft1155 is ERC1155 {
  string public name;

  constructor(
    string memory _name
  ) ERC1155('https://nft1155.com/api/{id}.json') {
    name = _name;
    _mint(msg.sender, 1, 1000, 'Platinum');
    _mint(msg.sender, 2, 1000, 'Gold');
    _mint(msg.sender, 3, 1000, 'Silver');
  }
}
