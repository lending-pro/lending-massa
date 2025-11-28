import { Address, call } from '@massalabs/massa-as-sdk';
import { Args } from '@massalabs/as-types';
import { u256 } from 'as-bignum/assembly';

/**
 * Flash Loan Callback Interface
 * Receiver contracts must implement the flashLoanCallback function
 */
export class IFlashLoanCallback {
  constructor(private _origin: Address) {}

  /**
   * Gets the address of this contract
   */
  get address(): Address {
    return this._origin;
  }

  /**
   * Executes the flash loan callback on the receiver contract
   * @param sender - Original caller who initiated the flash loan
   * @param token - Token address being borrowed
   * @param amount - Amount borrowed
   * @param fee - Fee amount that must be repaid
   * @returns true if callback was successful
   */
  flashLoanCallback(
    sender: Address,
    token: Address,
    amount: u256,
    fee: u256
  ): bool {
    const args = new Args()
      .add(sender)
      .add(token)
      .add(amount)
      .add(fee);

    const result = call(this._origin, 'flashLoanCallback', args, 0);
    const resultArgs = new Args(result);

    // Return the boolean result from the callback
    return resultArgs.nextBool().unwrap();
  }
}

/**
 * Helper function to create an IFlashLoanCallback instance from an address string
 * @param addressStr - String representation of the receiver address
 * @returns IFlashLoanCallback instance
 */
export function createFlashLoanCallbackInterface(addressStr: string): IFlashLoanCallback {
  const addr = new Address(addressStr);
  return new IFlashLoanCallback(addr);
}
