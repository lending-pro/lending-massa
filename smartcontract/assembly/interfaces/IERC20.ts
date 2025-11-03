import { Address, call } from '@massalabs/massa-as-sdk';
import { Args, bytesToU256 } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

/**
 * ERC20 Token Interface for interacting with token contracts
 */
export class IERC20 {
  constructor(private _origin: Address) {}

  /**
   * Gets the address of this token contract
   */
  get address(): Address {
    return this._origin;
  }

  /**
   * Transfers tokens from the contract to a recipient
   * @param to - Recipient address
   * @param amount - Amount to transfer
   */
  transfer(to: Address, amount: u256): void {
    const args = new Args().add(to).add(amount);
    call(this._origin, 'transfer', args, 0);
  }

  /**
   * Transfers tokens from one address to another (requires approval)
   * @param from - Sender address
   * @param to - Recipient address
   * @param amount - Amount to transfer
   */
  transferFrom(from: Address, to: Address, amount: u256): void {
    const args = new Args().add(from).add(to).add(amount);
    call(this._origin, 'transferFrom', args, 0);
  }

  /**
   * Gets the balance of an account
   * @param account - Address to query
   * @returns Balance of the account
   */
  balanceOf(account: Address): u256 {
    const args = new Args().add(account);
    const result = call(this._origin, 'balanceOf', args, 0);
    return bytesToU256(result);
  }

  /**
   * Approves a spender to spend tokens on behalf of the caller
   * @param spender - Address to approve
   * @param amount - Amount to approve
   */
  approve(spender: Address, amount: u256): void {
    const args = new Args().add(spender).add(amount);
    call(this._origin, 'approve', args, 0);
  }

  /**
   * Gets the allowance of a spender for an owner
   * @param owner - Token owner address
   * @param spender - Spender address
   * @returns Allowance amount
   */
  allowance(owner: Address, spender: Address): u256 {
    const args = new Args().add(owner).add(spender);
    const result = call(this._origin, 'allowance', args, 0);
    return bytesToU256(result);
  }

  /**
   * Gets the total supply of the token
   * @returns Total supply
   */
  totalSupply(): u256 {
    const args = new Args();
    const result = call(this._origin, 'totalSupply', args, 0);
    return bytesToU256(result);
  }

  /**
   * Gets the number of decimals of the token
   * @returns Number of decimals
   */
  decimals(): u8 {
    const args = new Args();
    const result = call(this._origin, 'decimals', args, 0);
    const resultArgs = new Args(result);
    return resultArgs.nextU8().unwrap();
  }

  /**
   * Gets the symbol of the token
   * @returns Token symbol
   */
  symbol(): string {
    const args = new Args();
    const result = call(this._origin, 'symbol', args, 0);
    const resultArgs = new Args(result);
    return resultArgs.nextString().unwrap();
  }

  /**
   * Gets the name of the token
   * @returns Token name
   */
  name(): string {
    const args = new Args();
    const result = call(this._origin, 'name', args, 0);
    const resultArgs = new Args(result);
    return resultArgs.nextString().unwrap();
  }
}

/**
 * Helper function to create an IERC20 instance from an address string
 * @param addressStr - String representation of the token address
 * @returns IERC20 instance
 */
export function createTokenInterface(addressStr: string): IERC20 {
  const addr = new Address(addressStr);
  return new IERC20(addr);
}
