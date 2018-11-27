import {
  Asset,
  Keypair,
  Memo,
  Network,
  Operation,
  Server,
  TransactionBuilder,
} from 'stellar-sdk'

import { Prisma } from './generated/prisma'

export interface Context {
  db: Prisma
  request: any
}


export const ENVCryptoSecret = 'MamaTestnetSecret-for-poc-only'

export const MamaUSD = new Asset(
  'USD',
  'GCQO3EHXPCXDWNACFEASX3QTW4H7T2X6PJ57TH7OOPFUHGSGDGIZKJP4' 
  // ^^ Stellar address for MamaUSD issuer account
)

// In production, do not store secret keys like these in code. Use something like KMS and put these secrets somewhere very safe.
export const mamaUSDBankKeypair = Keypair.fromSecret('SAS2GZXWDU2TXHXQREV3OJHIY7SC54553UB54WHOOCTA3GJB47VBOXYE')
// ^^ this is MamaUSD-bank's  key, which has been authorized as a signer for the MamaUSD account (see Lumen CLI notes)
export const mamaUSDKeyIssuerPubKey = 'GCQO3EHXPCXDWNACFEASX3QTW4H7T2X6PJ57TH7OOPFUHGSGDGIZKJP4'

export async function createAccountInLedger(newAcctPubKey: string) {
  try {
    // Tell the Stellar SDK you are using the testnet
    Network.useTestNetwork()
    // point to testnet host
    const stellarServer = new Server('https://horizon-testnet.stellar.org')

    // In poduction, don't put values like this account seed below in code
    const mamaPOCFunderKeypair = Keypair.fromSecret('SBZ7D6FAHTUGWYZYR5MHLT3GOT6RW7H2I3GESQP2OO6YFZQP5QD4OHFF')

      // Load account from Stellar
    const mamaPOCFunder = await stellarServer.loadAccount(mamaPOCFunderKeypair.publicKey())

    console.log('Creating new account in ledger with public key: ', newAcctPubKey)

    let transaction = new TransactionBuilder(mamaPOCFunder)
      .addOperation(
        Operation.createAccount({
          destination: newAcctPubKey,
          startingBalance: '999'
        })
      ).build()

      // Sign the transaction above
      transaction.sign(mamaPOCFunderKeypair)
      
      // Submit transaction to the server
      const result = await stellarServer.submitTransaction(transaction)
      console.log('Account created! -> ' + JSON.stringify(result, null, 3))
  } catch (e) {
    console.log('Stellar account not created.', e)
  }
}

export async function createTrustline(acctKeypair: Keypair) {
  Network.useTestNetwork()
  const stellarServer = new Server('https://horizon-testnet.stellar.org')

  try {
    const account = await stellarServer.loadAccount(acctKeypair.publicKey())
    const transaction = new TransactionBuilder(account)
    .addOperation(
      Operation.changeTrust({
        asset: MamaUSD,
      })
    )
    .build()

    transaction.sign(acctKeypair)
    const result = await stellarServer.submitTransaction(transaction)

    console.log(`trustline created from account ${acctKeypair.publicKey()} to MamaUSD issuer and signers updated`, result)

    return result
  } catch (err) {
    console.log('RUH ROH! Create trustline failed.', err)
  }
}

export async function allowTrust(trustor: string) {
  Network.useTestNetwork()
  const stellarServer = new Server('https://horizon-testnet.stellar.org')

  try {
    // const mamaUSDBankKeypair = Keypair.fromSecret('SAS2GZXWDU2TXHXQREV3OJHIY7SC54553UB54WHOOCTA3GJB47VBOXYE')
    // ^^ Moved this to top into global space

    const mamaUSDBank = await stellarServer.loadAccount(mamaUSDBankKeypair.publicKey())


    // const mamaUSDKeyIssuerPubKey = 'GCQO3EHXPCXDWNACFEASX3QTW4H7T2X6PJ57TH7OOPFUHGSGDGIZKJP4'
    // ^^ Moved to global scope and exported

    let transaction = new TransactionBuilder(mamaUSDBank)
    // const transaction = new TransactionBuilder(mamaUSDIssuer)
    .addOperation(
      Operation.allowTrust({
        trustor: trustor,
        assetCode: MamaUSD.code,
        authorize: true,
        source: mamaUSDKeyIssuerPubKey,
      })
    )
    .build()

    transaction.sign(mamaUSDBankKeypair)

    const result = await stellarServer.submitTransaction(transaction)

    console.log('trustline approved', result)
    return result
  } catch (err) {
    console.log('trustline DENIED.') 
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)
  }

}

export async function payment(senderKeys: Keypair, destination: string, amount: string, memo?: string) {
  Network.useTestNetwork()
  const stellarServer = new Server('https://horizon-testnet.stellar.org')

  const account = await stellarServer.loadAccount(senderKeys.publicKey())

  // check balance of account:
  console.log('Balances for sender account: ', senderKeys.publicKey());
  account.balances.forEach((balance) => console.log('Type:', balance.asset_type, ', Balance:', balance.balance))

  // check if there's a memo
  memo = memo || ''

  let transaction = new TransactionBuilder(account)
  .addOperation(
    Operation.payment({
      destination,
      asset: MamaUSD,
      amount,
    })
  )
  .addMemo(Memo.text(memo))
  .build()

  transaction.sign(senderKeys)

  console.log(`sending ${amount} from ${senderKeys.publicKey()} to ${destination} `)
  
  try {
    const result = await stellarServer.submitTransaction(transaction)
    console.log('Transaction Successful! -> ', JSON.stringify(result, null, 3))
    console.log('Transaction Successful! Payment successfully made! Hash for transaction -> ', result.hash)
    
    return result
  } catch (err) {
    console.error('ERROR: ')
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)

    throw err
  }
}
