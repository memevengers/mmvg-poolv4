// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IPoolV4Public {
  function getPoolTime() external view returns (uint, uint, uint);

  function getPoolInfo()
    external
    view
    returns (
      address,
      uint,
      address,
      address,
      uint,
      address,
      uint,
      uint,
      uint,
      uint,
      uint,
      uint
    );

  function getPosition(
    address _account
  ) external view returns (uint, uint[] memory, uint[] memory, uint);

  function stakingTokenUnit() external view returns (uint);

  function rewardsTokenUnit() external view returns (uint);

  function sharePerNft() external view returns (uint);

  function poolShareAmount() external view returns (uint);

  function poolTokenAmount() external view returns (uint);

  function poolNft721Amount() external view returns (uint);

  function poolNft1155Amount() external view returns (uint);

  function poolRewardsAmount() external view returns (uint);

  function depositToken(uint _amount) external;

  function depositNft721AndToken(
    uint _nft721TokenId,
    uint _tokenAmount
  ) external;

  function depositNft1155AndToken(
    uint _nft1155TokenId,
    uint _nft1155Amount,
    uint _tokenAmount
  ) external;

  function withdrawAll() external;
}
