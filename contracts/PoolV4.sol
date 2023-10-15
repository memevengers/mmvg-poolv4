// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/SafeCast.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol';

import './IPoolV4Public.sol';

contract PoolV4 is IPoolV4Public, Ownable, IERC721Receiver, IERC1155Receiver {
  using SafeCast for uint;

  bool public isPaused = false;

  string public name;

  uint public startTs;
  uint public endTs;
  uint public withdrawEnableTs;

  uint public lastIssuedTs;
  uint public rewardsPerSecond;

  uint public arps; // accumulativeRewardsPerShare

  IERC20 public stakingToken;
  uint public stakingTokenUnit;

  IERC721 public stakingNft721;
  IERC1155 public stakingNft1155;
  uint public stakingNft1155Id;

  uint public sharePerNft;

  IERC20 public rewardsToken;
  uint public rewardsTokenUnit;

  uint public poolShareAmount;
  uint public poolTokenAmount;
  uint public poolNft721Amount;
  uint public poolNft1155Amount;
  uint public poolRewardsAmount;

  struct Position {
    uint token;
    uint[] nft721Ids;
    uint[] nft1155Ids;
    mapping(uint => uint) nft1155Amounts;
    uint share;
    uint rewardsDebt;
  }
  mapping(address => Position) public positions;

  // Config (Pool limit, User limit, whitelist ... )
  struct PoolLimit {
    uint stakingTokenMax;
    uint stakingNftMax;
  }
  PoolLimit public poolLimit;

  struct UserLimit {
    uint stakingTokenMin;
    uint stakingNftMin;
  }
  UserLimit public userLimit;

  uint public whitelistLength;
  mapping(address => bool) public whitelist;

  // Events
  event DepositToken(address indexed user, uint amount);
  event WithdrawToken(address indexed user, uint amount);

  event DepositNft721(address indexed user, uint tokenId);
  event WithdrawNft721(address indexed user, uint tokenId);
  event ReceivedNft721(address indexed user, uint tokenId);

  event DepositNft1155(address indexed user, uint tokenId, uint amount);
  event WithdrawNft1155(address indexed user, uint tokenId, uint amount);
  event ReceivedNft1155(address indexed user, uint tokenId, uint amount);

  event ClaimAllRewards(address indexed user, uint amount);
  event AddRewards(uint reward);
  event UpdatePool(uint accumulativeRewardsPerShare);

  event Paused();
  event Unpaused();

  constructor(
    string memory _name,
    uint[3] memory _poolTs, // startTs, endTs, withdrawEnableTs,
    IERC20 _stakingToken,
    IERC721 _stakingNft721,
    IERC1155 _stakingNft1155,
    uint _stakingNft1155Id,
    uint _sharePerNft,
    IERC20 _rewardsToken,
    uint[4] memory _config,
    address[] memory _whitelist
  ) {
    name = _name;

    startTs = _poolTs[0];
    endTs = _poolTs[1];
    withdrawEnableTs = _poolTs[2];

    require(startTs < endTs, 'Invalid start/end Timestamp');
    require(
      startTs <= withdrawEnableTs && withdrawEnableTs <= endTs,
      'Invalid withdraw Timestamp'
    );

    stakingToken = _stakingToken;
    stakingTokenUnit = _getUnit(_stakingToken);

    stakingNft721 = _stakingNft721;
    stakingNft1155 = _stakingNft1155;
    stakingNft1155Id = _stakingNft1155Id;
    sharePerNft = _sharePerNft;

    require(
      address(_stakingToken) != address(0) ||
        address(_stakingNft721) != address(0) ||
        address(_stakingNft1155) != address(0),
      'At least one of the stakingToken or stakingNft721 or stakingNft1155 must be non-zero address'
    );

    rewardsToken = _rewardsToken;
    rewardsTokenUnit = _getUnit(_rewardsToken);

    poolLimit.stakingTokenMax = _config[0];
    if (_config[0] == 0) {
      poolLimit.stakingTokenMax = type(uint).max;
    }
    poolLimit.stakingNftMax = _config[1];
    if (_config[1] == 0) {
      poolLimit.stakingNftMax = type(uint).max;
    }

    userLimit.stakingTokenMin = _config[2];
    userLimit.stakingNftMin = _config[3];

    whitelistLength = _whitelist.length;
    for (uint _i = 0; _i < _whitelist.length; _i++) {
      whitelist[_whitelist[_i]] = true;
    }
  }

  // Internal functions
  function _getUnit(IERC20 _token) internal view returns (uint) {
    if (address(_token) == address(0)) {
      return 10 ** 18;
    }
    return 10 ** uint(IERC20Metadata(address(_token)).decimals());
  }

  function _mulFloat(
    uint _num,
    uint _float,
    uint _floatUnit
  ) internal pure returns (uint) {
    return (_num * _float) / _floatUnit;
  }

  function _min(uint _a, uint _b) internal pure returns (uint) {
    if (_a < _b) return _a;
    return _b;
  }

  function _max(uint _a, uint _b) internal pure returns (uint) {
    if (_a < _b) return _b;
    return _a;
  }

  function _updatePool() internal {
    if (poolShareAmount == 0) {
      return;
    }
    if (block.timestamp <= startTs) {
      return;
    }
    if (lastIssuedTs == endTs) {
      return;
    }
    if (lastIssuedTs < startTs) {
      lastIssuedTs = startTs;
    }

    uint _duration = _min(block.timestamp, endTs) - lastIssuedTs;
    uint _issuedRewards = rewardsPerSecond * _duration;

    arps += (_issuedRewards * stakingTokenUnit) / uint(poolShareAmount);

    lastIssuedTs = _min(block.timestamp, endTs);
    emit UpdatePool(arps);
  }

  function _depositTokenAtPosition(
    Position storage _pos,
    uint _amount
  ) internal {
    _pos.token += _amount;
    _pos.share += _amount;
    poolTokenAmount += _amount;
    poolShareAmount += _amount;
    _updateRewardsDebt(_pos);
  }

  function _withdrawTokenAtPosition(
    Position storage _pos,
    uint _amount
  ) internal {
    _pos.token -= _amount;
    _pos.share -= _amount;
    poolTokenAmount -= _amount;
    poolShareAmount -= _amount;
    _updateRewardsDebt(_pos);
  }

  function _depositNft721AtPosition(
    Position storage _pos,
    uint _tokenId
  ) internal {
    _pos.nft721Ids.push(_tokenId);
    _pos.share += sharePerNft;

    poolNft721Amount += 1;
    poolShareAmount += sharePerNft;
    _updateRewardsDebt(_pos);
  }

  function _withdrawNft721AtPosition(
    Position storage _pos,
    uint _tokenId
  ) internal {
    uint _length = _pos.nft721Ids.length;
    for (uint _i = 0; _i < _length; _i++) {
      if (_pos.nft721Ids[_i] == _tokenId) {
        _pos.nft721Ids[_i] = _pos.nft721Ids[_length - 1];
        _pos.nft721Ids.pop();
        break;
      }
    }
    require(_length > _pos.nft721Ids.length, 'Invalid NFT-721 ID');
    _pos.share -= sharePerNft;

    poolNft721Amount -= 1;
    poolShareAmount -= sharePerNft;
    _updateRewardsDebt(_pos);
  }

  function _depositNft1155AtPosition(
    Position storage _pos,
    uint _tokenId,
    uint _amount
  ) internal {
    _pos.nft1155Amounts[_tokenId] += _amount;
    _pos.nft1155Ids.push(_tokenId);

    _pos.share += sharePerNft;
    poolNft1155Amount += 1;
    poolShareAmount += sharePerNft;
    _updateRewardsDebt(_pos);
  }

  function _withdrawNft1155AtPosition(
    Position storage _pos,
    uint _tokenId,
    uint _amount
  ) internal {
    require(
      _pos.nft1155Amounts[_tokenId] >= _amount,
      'Withdraw amount exceeds staked amount'
    );
    _pos.nft1155Amounts[_tokenId] -= _amount;
    uint _length = _pos.nft1155Ids.length;
    for (uint i = 0; i < _length; i++) {
      if (_pos.nft1155Ids[i] == _tokenId) {
        _pos.nft1155Ids[i] = _pos.nft1155Ids[_length - 1];
        _pos.nft1155Ids.pop();
        break;
      }
    }
    require(_length > _pos.nft1155Ids.length, 'Invalid NFT-1155 ID');
    _pos.share -= sharePerNft;

    poolNft1155Amount -= 1;
    poolShareAmount -= sharePerNft;
    _updateRewardsDebt(_pos);
  }

  function _updateRewardsDebt(Position storage _pos) internal {
    _pos.rewardsDebt += _mulFloat(_pos.share, arps, rewardsTokenUnit);
  }

  // Modifiers

  modifier isNotPaused() {
    require(!isPaused, 'Pool is paused');
    _;
  }

  modifier isOpen() {
    require(
      block.timestamp >= startTs && block.timestamp <= endTs,
      'Pool is not open'
    );
    _;
  }

  modifier checkWhitelist() {
    if (whitelistLength > 0) {
      require(whitelist[msg.sender], 'User is not whitelisted');
    }
    _;
  }

  modifier isWithdrawEnabled() {
    require(withdrawEnableTs <= block.timestamp, 'Withdraw is not enabled yet');
    _;
  }

  // Public functions

  // Token deposit / withdraw
  function depositToken(uint _amount) public isNotPaused isOpen checkWhitelist {
    require(address(stakingToken) != address(0), 'Token is not supported');
    require(_amount > 0, 'Cannot deposit 0 tokens');

    Position storage _pos = positions[msg.sender];

    // check NFT staking
    if (address(stakingNft721) != address(0)) {
      require(_pos.nft721Ids.length > 0, 'NFT-721 is not staked.');
    }
    if (address(stakingNft1155) != address(0)) {
      require(_pos.nft1155Ids.length > 0, 'NFT-1155 is not staked.');
    }

    require(
      poolTokenAmount + _amount <= poolLimit.stakingTokenMax,
      'Pool limit exceeded (maximum)'
    );
    require(
      userLimit.stakingTokenMin <= _amount,
      'User limit exceeded (minimum)'
    );

    _updatePool();
    stakingToken.transferFrom(msg.sender, address(this), _amount);
    _depositTokenAtPosition(_pos, _amount);

    emit DepositToken(msg.sender, _amount);
  }

  function withdrawToken(
    uint _amount
  ) public isNotPaused isWithdrawEnabled checkWhitelist {
    require(address(stakingToken) != address(0), 'Token is not supported');
    require(_amount > 0, 'Cannot withdraw 0 tokens');

    Position storage _pos = positions[msg.sender];
    require(_amount <= _pos.token, 'Withdraw amount exceeds staked amount');

    _updatePool();
    stakingToken.transferFrom(address(this), msg.sender, _amount);
    _withdrawTokenAtPosition(_pos, _amount);

    emit WithdrawToken(msg.sender, _amount);
  }

  // NFT-721 deposit / withdraw
  function depositNft721(
    uint _tokenId
  ) public isNotPaused isOpen checkWhitelist {
    require(address(stakingNft721) != address(0), 'NFT-721 is not supported');
    require(
      stakingNft721.ownerOf(_tokenId) == msg.sender,
      'NFT is not owned by the user'
    );
    require(
      poolNft721Amount + 1 <= poolLimit.stakingNftMax,
      'Pool limit exceeded (maximum)'
    );

    _updatePool();
    stakingNft721.transferFrom(msg.sender, address(this), _tokenId);
    Position storage _pos = positions[msg.sender];
    _depositNft721AtPosition(_pos, _tokenId);

    emit DepositNft721(msg.sender, _tokenId);
  }

  function withdrawNft721(
    uint _tokenId
  ) public isNotPaused isWithdrawEnabled checkWhitelist {
    require(address(stakingNft721) != address(0), 'NFT-721 is not supported');

    Position storage _pos = positions[msg.sender];
    require(_pos.nft721Ids.length > 0, 'NFT-721 is not staked');

    _updatePool();
    stakingNft721.transferFrom(address(this), msg.sender, _tokenId);
    _withdrawNft721AtPosition(_pos, _tokenId);

    emit WithdrawNft721(msg.sender, _tokenId);
  }

  // NFT-1155 deposit / withdraw
  function depositNft1155(
    uint _tokenId,
    uint _amount
  ) public isNotPaused isOpen checkWhitelist {
    require(address(stakingNft1155) != address(0), 'NFT-1155 is not supported');
    require(_amount > 0, 'Cannot deposit 0 NFTs');
    if (stakingNft1155Id != 0) {
      require(stakingNft1155Id == _tokenId, 'Invalid NFT-1155 ID');
    }
    require(
      _amount <= stakingNft1155.balanceOf(msg.sender, _tokenId),
      'NFT is not owned by the user'
    );
    require(
      poolNft721Amount + _amount <= poolLimit.stakingNftMax,
      'Pool limit exceeded (maximum)'
    );

    Position storage _pos = positions[msg.sender];
    require(
      userLimit.stakingNftMin <= _amount,
      'User limit exceeded (minimum)'
    );

    _updatePool();
    stakingNft1155.safeTransferFrom(
      msg.sender,
      address(this),
      _tokenId,
      _amount,
      ''
    );
    _depositNft1155AtPosition(_pos, _tokenId, _amount);

    emit DepositNft1155(msg.sender, _tokenId, _amount);
  }

  function withdrawNft1155(
    uint _tokenId,
    uint _amount
  ) public isNotPaused isWithdrawEnabled checkWhitelist {
    require(address(stakingNft1155) != address(0), 'NFT-1155 is not supported');
    require(_amount > 0, 'Cannot withdraw 0 NFTs');

    Position storage _pos = positions[msg.sender];
    require(
      _amount <= _pos.nft1155Amounts[_tokenId],
      'Withdraw amount exceeds staked amount'
    );

    _updatePool();
    stakingNft1155.safeTransferFrom(
      address(this),
      msg.sender,
      _tokenId,
      _amount,
      ''
    );
    _withdrawNft1155AtPosition(_pos, _tokenId, _amount);

    emit WithdrawNft1155(msg.sender, _tokenId, _amount);
  }

  // Deposit nft and token
  function depositNft721AndToken(
    uint _nft721TokenId,
    uint _tokenAmount
  ) public isNotPaused isOpen checkWhitelist {
    depositNft721(_nft721TokenId);
    depositToken(_tokenAmount);
  }

  function depositNft1155AndToken(
    uint _nft1155TokenId,
    uint _nft1155Amount,
    uint _tokenAmount
  ) public isNotPaused isOpen checkWhitelist {
    depositNft1155(_nft1155TokenId, _nft1155Amount);
    depositToken(_tokenAmount);
  }

  // Withdraw all
  function withdrawAll() public isNotPaused isWithdrawEnabled checkWhitelist {
    Position storage _pos = positions[msg.sender];
    require(_pos.share > 0, 'Nothing to withdraw');

    claimAllRewards();

    if (_pos.token > 0) {
      withdrawToken(_pos.token);
    }
    if (_pos.nft721Ids.length > 0) {
      for (uint _i = 0; _i < _pos.nft721Ids.length; _i++) {
        withdrawNft721(_pos.nft721Ids[_i]);
      }
    }
    if (_pos.nft1155Ids.length > 0) {
      for (uint _i = 0; _i < _pos.nft1155Ids.length; _i++) {
        uint _tokenId = _pos.nft1155Ids[_i];
        withdrawNft1155(_tokenId, _pos.nft1155Amounts[_tokenId]);
      }
    }
  }

  // Rewards
  function claimAllRewards() public isNotPaused checkWhitelist {
    _updatePool();

    Position storage _pos = positions[msg.sender];
    uint _rewards = _mulFloat(_pos.share, arps, rewardsTokenUnit) -
      _pos.rewardsDebt;
    if (_rewards <= 0) {
      return;
    }
    _pos.rewardsDebt += _rewards;
    rewardsToken.transfer(msg.sender, _rewards);

    emit ClaimAllRewards(msg.sender, _rewards);
  }

  // View functions

  function getPoolTime() external view returns (uint, uint, uint) {
    return (startTs, endTs, withdrawEnableTs);
  }

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
    )
  {
    return (
      address(stakingToken),
      stakingTokenUnit,
      address(stakingNft721),
      address(stakingNft1155),
      stakingNft1155Id,
      address(rewardsToken),
      rewardsTokenUnit,
      poolShareAmount,
      poolTokenAmount,
      poolNft721Amount,
      poolNft1155Amount,
      poolRewardsAmount
    );
  }

  function getPosition(
    address _account
  ) external view returns (uint, uint[] memory, uint[] memory, uint) {
    uint _pendingRewards = calcPendingRewards(_account);
    return (
      positions[_account].token,
      positions[_account].nft721Ids,
      positions[_account].nft1155Ids,
      _pendingRewards
    );
  }

  function calcPendingRewards(address _account) public view returns (uint) {
    require(lastIssuedTs <= block.timestamp, 'timestamp error');

    uint _duration = _min(block.timestamp, endTs) - lastIssuedTs;
    uint _issuedRewards = rewardsPerSecond * _duration;
    uint _arps = arps;
    if (poolShareAmount > 0) {
      _arps += ((_issuedRewards * stakingTokenUnit) / poolShareAmount);
    }

    Position storage _pos = positions[_account];
    uint _rewards = _mulFloat(_pos.share, _arps, rewardsTokenUnit) -
      _pos.rewardsDebt;
    return _rewards;
  }

  // ERC721Receiver, ERC1155Receiver
  function onERC721Received(
    address /* operator */,
    address from,
    uint256 tokenId,
    bytes calldata /* data */
  ) external override returns (bytes4) {
    require(
      address(stakingNft721) == msg.sender,
      'Only stakingNft721 can call this function'
    );
    emit ReceivedNft721(from, tokenId);
    return this.onERC721Received.selector;
  }

  function onERC1155Received(
    address /* operator */,
    address from,
    uint256 id,
    uint256 value,
    bytes calldata /* data */
  ) external override returns (bytes4) {
    require(
      address(stakingNft1155) == msg.sender,
      'Only stakingNft1155 can call this function'
    );
    emit ReceivedNft1155(from, id, value);
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address /* operator */,
    address /* from */,
    uint256[] calldata /* ids */,
    uint256[] calldata /* values */,
    bytes calldata /* data */
  ) external pure override returns (bytes4) {
    revert('Not supported');
  }

  function supportsInterface(
    bytes4 interfaceID
  ) external pure override returns (bool) {
    return interfaceID == type(IERC1155Receiver).interfaceId;
  }

  // Only owner functions
  function addRewards(uint _amount) external onlyOwner {
    require(block.timestamp <= endTs, 'Pool is ended');
    require(_amount > 0, 'Amount must be greater than 0');

    _updatePool();
    rewardsToken.transferFrom(msg.sender, address(this), _amount);

    poolRewardsAmount += _amount;
    rewardsPerSecond += _amount / (endTs - _max(block.timestamp, startTs));

    emit AddRewards(_amount);
  }

  function pause() external onlyOwner {
    isPaused = true;
    emit Paused();
  }

  function unpause() external onlyOwner {
    isPaused = false;
    emit Unpaused();
  }

  function emergencyTransferErc20(
    address _account,
    IERC20 _token,
    uint _amount
  ) external onlyOwner {
    require(isPaused, 'Pool is not paused');
    _token.transfer(_account, _amount);
  }

  function emergencyTransferErc721(
    address _account,
    IERC721 _token,
    uint _tokenId
  ) external onlyOwner {
    require(isPaused, 'Pool is not paused');
    _token.safeTransferFrom(address(this), _account, _tokenId);
  }

  function emergencyTransferErc1155(
    address _account,
    IERC1155 _token,
    uint _tokenId,
    uint _amount
  ) external onlyOwner {
    require(isPaused, 'Pool is not paused');
    _token.safeTransferFrom(address(this), _account, _tokenId, _amount, '');
  }
}
