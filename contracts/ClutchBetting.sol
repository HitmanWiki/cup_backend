// contracts/ClutchBetting.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title ClutchBetting
 * @dev Decentralized betting platform for World Cup 2026
 */
contract ClutchBetting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    
    // ========== CONSTANTS ==========
    uint256 public constant PLATFORM_FEE_PERCENT = 200; // 2%
    uint256 public constant ORACLE_FEE_PERCENT = 100;   // 1%
    uint256 public constant WINNERS_PERCENT = 9700;     // 97%
    uint256 public constant PERCENT_DIVISOR = 10000;
    
    uint256 public constant MIN_BET_AMOUNT = 1 ether;
    uint256 public constant MAX_BET_AMOUNT = 10000 ether;
    
    // ========== ENUMS ==========
    enum MatchStatus { UPCOMING, LIVE, FINISHED, CANCELLED }
    enum BetStatus { PENDING, WON, LOST, REFUNDED, CANCELLED }
    enum Outcome { TEAM_A, DRAW, TEAM_B }
    
    // ========== STRUCTS ==========
    struct Match {
        uint256 id;
        string teamA;
        string teamB;
        uint256 timestamp;
        uint256 oddsTeamA;   // Multiplied by 100 (2.5 = 250)
        uint256 oddsDraw;    // Multiplied by 100
        uint256 oddsTeamB;   // Multiplied by 100
        Outcome result;
        MatchStatus status;
        uint256 totalStaked;
        bool resultVerified;
        uint256 createdBlock;
    }
    
    struct Bet {
        uint256 id;
        uint256 matchId;
        address bettor;
        Outcome predicted;
        uint256 amount;
        uint256 potentialWin;
        BetStatus status;
        bool claimed;
        uint256 timestamp;
        uint256 placedBlock;
    }
    
    struct UltimateBet {
        uint256 id;
        address bettor;
        uint256 teamId;
        string teamName;
        uint256 amount;
        uint256 potentialWin;
        uint256 odds;
        bool active;
        bool claimed;
        uint256 placedBlock;
    }
    
    // ========== STATE VARIABLES ==========
    uint256 public matchCounter;
    uint256 public betCounter;
    uint256 public ultimateBetCounter;
    uint256 public totalPool;
    uint256 public totalFeesCollected;
    
    mapping(uint256 => Match) public matches;
    mapping(uint256 => Bet) public bets;
    mapping(uint256 => UltimateBet) public ultimateBets;
    mapping(address => uint256[]) public userBets;
    mapping(uint256 => uint256[]) public matchBets;
    mapping(address => bool) public isOracle;
    mapping(address => bool) public isAdmin;
    
    // ========== EVENTS ==========
    event MatchCreated(
        uint256 indexed matchId,
        string teamA,
        string teamB,
        uint256 timestamp,
        uint256 oddsTeamA,
        uint256 oddsDraw,
        uint256 oddsTeamB
    );
    
    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 indexed matchId,
        Outcome predicted,
        uint256 amount,
        uint256 potentialWin
    );
    
    event UltimateBetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        string teamName,
        uint256 amount,
        uint256 potentialWin
    );
    
    event MatchResultSet(
        uint256 indexed matchId,
        Outcome result,
        address indexed setBy
    );
    
    event WinningsClaimed(
        address indexed bettor,
        uint256 amount,
        uint256 indexed betId
    );
    
    event UltimateWinningsClaimed(
        address indexed bettor,
        uint256 amount,
        uint256 indexed betId
    );
    
    event FeesWithdrawn(
        address indexed to,
        uint256 amount
    );
    
    event OracleAdded(address indexed oracle);
    event OracleRemoved(address indexed oracle);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    
    // ========== MODIFIERS ==========
    modifier onlyOracle() {
        require(isOracle[msg.sender] || msg.sender == owner(), "Not oracle");
        _;
    }
    
    modifier onlyAdmin() {
        require(isAdmin[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }
    
    modifier validMatch(uint256 _matchId) {
        require(_matchId > 0 && _matchId <= matchCounter, "Invalid match");
        _;
    }
    
    modifier matchUpcoming(uint256 _matchId) {
        require(matches[_matchId].status == MatchStatus.UPCOMING, "Match not bettable");
        _;
    }
    
    modifier matchFinished(uint256 _matchId) {
        require(matches[_matchId].status == MatchStatus.FINISHED, "Match not finished");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    constructor() Ownable(msg.sender) {
        // Initialize owner as admin and oracle
        isAdmin[msg.sender] = true;
        isOracle[msg.sender] = true;
        
        emit AdminAdded(msg.sender);
        emit OracleAdded(msg.sender);
    }
    
    // ========== MATCH MANAGEMENT ==========
    /**
     * @dev Create a new match
     */
    function createMatch(
        string memory _teamA,
        string memory _teamB,
        uint256 _timestamp,
        uint256 _oddsTeamA,
        uint256 _oddsDraw,
        uint256 _oddsTeamB
    ) external onlyAdmin returns (uint256) {
        require(_timestamp > block.timestamp, "Match time must be in future");
        require(_oddsTeamA >= 101 && _oddsTeamA <= 10000, "Invalid odds for team A");
        require(_oddsDraw >= 101 && _oddsDraw <= 10000, "Invalid odds for draw");
        require(_oddsTeamB >= 101 && _oddsTeamB <= 10000, "Invalid odds for team B");
        
        matchCounter++;
        
        matches[matchCounter] = Match({
            id: matchCounter,
            teamA: _teamA,
            teamB: _teamB,
            timestamp: _timestamp,
            oddsTeamA: _oddsTeamA,
            oddsDraw: _oddsDraw,
            oddsTeamB: _oddsTeamB,
            result: Outcome.TEAM_A, // Default, will be set later
            status: MatchStatus.UPCOMING,
            totalStaked: 0,
            resultVerified: false,
            createdBlock: block.number
        });
        
        emit MatchCreated(
            matchCounter,
            _teamA,
            _teamB,
            _timestamp,
            _oddsTeamA,
            _oddsDraw,
            _oddsTeamB
        );
        
        return matchCounter;
    }
    
    /**
     * @dev Update match status
     */
    function updateMatchStatus(
        uint256 _matchId,
        MatchStatus _status
    ) external validMatch(_matchId) onlyAdmin {
        Match storage matchData = matches[_matchId];
        
        // Validate status transition
        if (_status == MatchStatus.CANCELLED) {
            require(
                matchData.status == MatchStatus.UPCOMING,
                "Can only cancel upcoming matches"
            );
        } else if (_status == MatchStatus.FINISHED) {
            require(
                matchData.status == MatchStatus.LIVE,
                "Can only finish live matches"
            );
        }
        
        matchData.status = _status;
    }
    
    /**
     * @dev Set match result (can be called by oracle or admin)
     */
    function setMatchResult(
        uint256 _matchId,
        Outcome _result
    ) external validMatch(_matchId) matchFinished(_matchId) onlyOracle {
        Match storage matchData = matches[_matchId];
        
        require(!matchData.resultVerified, "Result already verified");
        require(_result == Outcome.TEAM_A || _result == Outcome.DRAW || _result == Outcome.TEAM_B, "Invalid result");
        
        matchData.result = _result;
        matchData.resultVerified = true;
        
        emit MatchResultSet(_matchId, _result, msg.sender);
    }
    
    // ========== BETTING FUNCTIONS ==========
    /**
     * @dev Place a bet on a match
     */
    function placeBet(
        uint256 _matchId,
        Outcome _predicted
    ) external payable nonReentrant validMatch(_matchId) matchUpcoming(_matchId) {
        require(msg.value >= MIN_BET_AMOUNT, "Bet amount too low");
        require(msg.value <= MAX_BET_AMOUNT, "Bet amount too high");
        require(
            _predicted == Outcome.TEAM_A || 
            _predicted == Outcome.DRAW || 
            _predicted == Outcome.TEAM_B,
            "Invalid prediction"
        );
        
        Match storage matchData = matches[_matchId];
        
        // Calculate odds based on prediction
        uint256 odds;
        if (_predicted == Outcome.TEAM_A) {
            odds = matchData.oddsTeamA;
        } else if (_predicted == Outcome.DRAW) {
            odds = matchData.oddsDraw;
        } else {
            odds = matchData.oddsTeamB;
        }
        
        // Calculate fees
        uint256 platformFee = msg.value.mul(PLATFORM_FEE_PERCENT).div(PERCENT_DIVISOR);
        uint256 oracleFee = msg.value.mul(ORACLE_FEE_PERCENT).div(PERCENT_DIVISOR);
        uint256 netAmount = msg.value.sub(platformFee).sub(oracleFee);
        
        // Calculate potential win
        uint256 potentialWin = netAmount.mul(odds).div(100);
        
        // Create bet
        betCounter++;
        bets[betCounter] = Bet({
            id: betCounter,
            matchId: _matchId,
            bettor: msg.sender,
            predicted: _predicted,
            amount: netAmount,
            potentialWin: potentialWin,
            status: BetStatus.PENDING,
            claimed: false,
            timestamp: block.timestamp,
            placedBlock: block.number
        });
        
        // Update mappings
        userBets[msg.sender].push(betCounter);
        matchBets[_matchId].push(betCounter);
        
        // Update match total staked
        matchData.totalStaked = matchData.totalStaked.add(netAmount);
        
        // Update contract totals
        totalPool = totalPool.add(netAmount);
        totalFeesCollected = totalFeesCollected.add(platformFee).add(oracleFee);
        
        emit BetPlaced(
            betCounter,
            msg.sender,
            _matchId,
            _predicted,
            msg.value,
            potentialWin
        );
    }
    
    /**
     * @dev Place an ultimate bet (champion prediction)
     */
    function placeUltimateBet(
        uint256 _teamId,
        string memory _teamName,
        uint256 _odds
    ) external payable nonReentrant {
        require(msg.value >= MIN_BET_AMOUNT, "Bet amount too low");
        require(msg.value <= MAX_BET_AMOUNT, "Bet amount too high");
        require(_odds >= 101 && _odds <= 10000, "Invalid odds");
        
        // Check if user already has active ultimate bet
        for (uint256 i = 1; i <= ultimateBetCounter; i++) {
            if (ultimateBets[i].bettor == msg.sender && ultimateBets[i].active) {
                revert("Already have active ultimate bet");
            }
        }
        
        // Calculate fees
        uint256 platformFee = msg.value.mul(PLATFORM_FEE_PERCENT).div(PERCENT_DIVISOR);
        uint256 oracleFee = msg.value.mul(ORACLE_FEE_PERCENT).div(PERCENT_DIVISOR);
        uint256 netAmount = msg.value.sub(platformFee).sub(oracleFee);
        
        // Calculate potential win
        uint256 potentialWin = netAmount.mul(_odds).div(100);
        
        // Create ultimate bet
        ultimateBetCounter++;
        ultimateBets[ultimateBetCounter] = UltimateBet({
            id: ultimateBetCounter,
            bettor: msg.sender,
            teamId: _teamId,
            teamName: _teamName,
            amount: netAmount,
            potentialWin: potentialWin,
            odds: _odds,
            active: true,
            claimed: false,
            placedBlock: block.number
        });
        
        // Update contract totals
        totalPool = totalPool.add(netAmount);
        totalFeesCollected = totalFeesCollected.add(platformFee).add(oracleFee);
        
        emit UltimateBetPlaced(
            ultimateBetCounter,
            msg.sender,
            _teamName,
            msg.value,
            potentialWin
        );
    }
    
    /**
     * @dev Claim winnings for a regular bet
     */
    function claimBetWinnings(
        uint256 _betId
    ) external nonReentrant {
        require(_betId > 0 && _betId <= betCounter, "Invalid bet");
        
        Bet storage bet = bets[_betId];
        require(bet.bettor == msg.sender, "Not your bet");
        require(bet.status == BetStatus.WON, "Bet did not win");
        require(!bet.claimed, "Already claimed");
        require(bet.amount > 0, "Invalid bet amount");
        
        Match storage matchData = matches[bet.matchId];
        require(matchData.resultVerified, "Result not verified");
        
        // Mark as claimed
        bet.claimed = true;
        
        // Calculate actual winnings (97% of potential)
        uint256 winnings = bet.potentialWin.mul(WINNERS_PERCENT).div(PERCENT_DIVISOR);
        
        // Transfer winnings
        (bool success, ) = payable(msg.sender).call{value: winnings}("");
        require(success, "Transfer failed");
        
        // Update total pool
        totalPool = totalPool.sub(winnings);
        
        emit WinningsClaimed(msg.sender, winnings, _betId);
    }
    
    /**
     * @dev Claim ultimate bet winnings
     */
    function claimUltimateWinnings(
        uint256 _betId
    ) external nonReentrant {
        require(_betId > 0 && _betId <= ultimateBetCounter, "Invalid bet");
        
        UltimateBet storage bet = ultimateBets[_betId];
        require(bet.bettor == msg.sender, "Not your bet");
        require(bet.active, "Bet not active");
        require(!bet.claimed, "Already claimed");
        
        // Mark as claimed
        bet.claimed = true;
        bet.active = false;
        
        // Calculate actual winnings (97% of potential)
        uint256 winnings = bet.potentialWin.mul(WINNERS_PERCENT).div(PERCENT_DIVISOR);
        
        // Transfer winnings
        (bool success, ) = payable(msg.sender).call{value: winnings}("");
        require(success, "Transfer failed");
        
        // Update total pool
        totalPool = totalPool.sub(winnings);
        
        emit UltimateWinningsClaimed(msg.sender, winnings, _betId);
    }
    
    /**
     * @dev Refund bets if match is cancelled
     */
    function refundBets(
        uint256 _matchId
    ) external validMatch(_matchId) onlyAdmin nonReentrant {
        Match storage matchData = matches[_matchId];
        require(matchData.status == MatchStatus.CANCELLED, "Match not cancelled");
        
        uint256[] storage betIds = matchBets[_matchId];
        
        for (uint256 i = 0; i < betIds.length; i++) {
            uint256 betId = betIds[i];
            Bet storage bet = bets[betId];
            
            if (bet.status == BetStatus.PENDING) {
                bet.status = BetStatus.REFUNDED;
                
                // Refund amount (without fees)
                (bool success, ) = payable(bet.bettor).call{value: bet.amount}("");
                require(success, "Refund failed");
                
                // Update total pool
                totalPool = totalPool.sub(bet.amount);
            }
        }
    }
    
    // ========== ADMIN FUNCTIONS ==========
    /**
     * @dev Add oracle address
     */
    function addOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid address");
        require(!isOracle[_oracle], "Already oracle");
        
        isOracle[_oracle] = true;
        emit OracleAdded(_oracle);
    }
    
    /**
     * @dev Remove oracle address
     */
    function removeOracle(address _oracle) external onlyOwner {
        require(isOracle[_oracle], "Not oracle");
        
        isOracle[_oracle] = false;
        emit OracleRemoved(_oracle);
    }
    
    /**
     * @dev Add admin address
     */
    function addAdmin(address _admin) external onlyOwner {
        require(_admin != address(0), "Invalid address");
        require(!isAdmin[_admin], "Already admin");
        
        isAdmin[_admin] = true;
        emit AdminAdded(_admin);
    }
    
    /**
     * @dev Remove admin address
     */
    function removeAdmin(address _admin) external onlyOwner {
        require(isAdmin[_admin], "Not admin");
        
        isAdmin[_admin] = false;
        emit AdminRemoved(_admin);
    }
    
    /**
     * @dev Withdraw collected fees
     */
    function withdrawFees() external onlyOwner {
        uint256 amount = totalFeesCollected;
        require(amount > 0, "No fees to withdraw");
        
        totalFeesCollected = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Withdrawal failed");
        
        emit FeesWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Emergency withdrawal (only if something goes wrong)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    // ========== VIEW FUNCTIONS ==========
    /**
     * @dev Get match details
     */
    function getMatch(
        uint256 _matchId
    ) external view validMatch(_matchId) returns (
        string memory teamA,
        string memory teamB,
        uint256 timestamp,
        uint256 oddsTeamA,
        uint256 oddsDraw,
        uint256 oddsTeamB,
        MatchStatus status,
        uint256 totalStaked,
        bool resultVerified
    ) {
        Match storage matchData = matches[_matchId];
        
        return (
            matchData.teamA,
            matchData.teamB,
            matchData.timestamp,
            matchData.oddsTeamA,
            matchData.oddsDraw,
            matchData.oddsTeamB,
            matchData.status,
            matchData.totalStaked,
            matchData.resultVerified
        );
    }
    
    /**
     * @dev Get bet details
     */
    function getBet(
        uint256 _betId
    ) external view returns (
        uint256 matchId,
        address bettor,
        Outcome predicted,
        uint256 amount,
        uint256 potentialWin,
        BetStatus status,
        bool claimed,
        uint256 timestamp
    ) {
        require(_betId > 0 && _betId <= betCounter, "Invalid bet");
        
        Bet storage bet = bets[_betId];
        
        return (
            bet.matchId,
            bet.bettor,
            bet.predicted,
            bet.amount,
            bet.potentialWin,
            bet.status,
            bet.claimed,
            bet.timestamp
        );
    }
    
    /**
     * @dev Get user's active bets
     */
    function getUserActiveBets(
        address _user
    ) external view returns (uint256[] memory) {
        uint256[] storage userBetIds = userBets[_user];
        uint256 activeCount = 0;
        
        // Count active bets
        for (uint256 i = 0; i < userBetIds.length; i++) {
            if (bets[userBetIds[i]].status == BetStatus.PENDING) {
                activeCount++;
            }
        }
        
        // Create array of active bet IDs
        uint256[] memory activeBetIds = new uint256[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < userBetIds.length; i++) {
            uint256 betId = userBetIds[i];
            if (bets[betId].status == BetStatus.PENDING) {
                activeBetIds[index] = betId;
                index++;
            }
        }
        
        return activeBetIds;
    }
    
    /**
     * @dev Get total active bets count
     */
    function getTotalActiveBets() external view returns (uint256) {
        uint256 count = 0;
        
        for (uint256 i = 1; i <= betCounter; i++) {
            if (bets[i].status == BetStatus.PENDING) {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * @dev Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Get total bets count for a match
     */
    function getMatchBetsCount(
        uint256 _matchId
    ) external view validMatch(_matchId) returns (uint256) {
        return matchBets[_matchId].length;
    }
    
    /**
     * @dev Get user's total staked amount
     */
    function getUserTotalStaked(
        address _user
    ) external view returns (uint256) {
        uint256[] storage betIds = userBets[_user];
        uint256 total = 0;
        
        for (uint256 i = 0; i < betIds.length; i++) {
            Bet storage bet = bets[betIds[i]];
            if (bet.status == BetStatus.PENDING || bet.status == BetStatus.WON) {
                total = total.add(bet.amount);
            }
        }
        
        return total;
    }
    
    // ========== RECEIVE FUNCTION ==========
    receive() external payable {
        // Accept ETH transfers
    }
}