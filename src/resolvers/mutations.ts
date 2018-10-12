import {
  Context,
  allowTrust,
  createAccountInLedger,
  createTrustline,
  promoPayment,
  ENVCryptoSecret
} from '../utils'

import { AES, enc } from 'crypto-js'
import { 
  Asset,
  Memo,
  Keypair, // Keypair represents public and secret keys.
  Network, // Network provides helper methods to get the passphrase or id for different stellar networks.
  Server,  // Server handles the network connections.
  TransactionBuilder, // Helps you construct transactions.
  Operation // Operation helps you represent/build operations in Stellar network.
} from 'stellar-sdk'



// SIGNUP USER MUTATION:
export async function signupUser(_, { username }, context: Context, info) {
  const userKeypair = Keypair.random()
  const secret = AES.encrypt(userKeypair.secret(), ENVCryptoSecret).toString()
  const data = {
    username,
    stellarAccount: userKeypair.publicKey(),
    stellarSeed: secret
  }

  const user = await context.db.mutation.createUser({ data }, info)

  // In production, you don't want to block to do this operation or have the keys to create accounts in this same app. Use something like AWS lambda, or a separate system to provision the Stellar account.

  await createAccountInLedger(userKeypair.publicKey())
  await createTrustline(userKeypair)
  await allowTrust(userKeypair.publicKey())
  await promoPayment(userKeypair.publicKey(),'50')
  return user
}



// PAYMENT MUTATION:
// In production don't rely on the API to send you the sender's username. It should be based on the Auth/session token.
export async function makePayment(_, {amount, senderUsername, recipientUsername, memo }, context: Context, info) {
  const result = await context.db.query.users({
    where: {
      username_in: [senderUsername, recipientUsername]
    }
  })

  const [recipient, sender] = result
  // ^^ an array with the sender and recipient's info (id, username, stellar account info) in object form 
  // NOTE: Recipient info comes first for some reason.
  
  Network.useTestNetwork()
  const stellarServer = new Server('https://horizon-testnet.stellar.org')

  const signerKeys = Keypair.fromSecret(
    // In production, use something like KMS
    AES.decrypt(sender.stellarSeed, ENVCryptoSecret).toString(enc.Utf8)
  )
  
  const account = await stellarServer.loadAccount(sender.stellarAccount)
  
  // check balance of account:
  console.log('Balances for sender account: ', sender.stellarAccount);
  account.balances.forEach((balance) => console.log('Type:', balance.asset_type, ', Balance:', balance.balance))
  
  // use stellar's native lumens for now
  const asset = Asset.native()

  // check if there's a memo
  memo = memo || ''

  let tx = new TransactionBuilder(account)
  .addOperation(
    Operation.payment({
      destination: recipient.stellarAccount,
      asset,
      amount
    })
  )
  .addMemo(Memo.text(memo))
  .build()

  tx.sign(signerKeys)

  try {
    const { hash } = await stellarServer.submitTransaction(tx)
    console.log("Payment successfully made!", hash);
    
    return { id: hash, memo: memo || null }
  } catch (err) {
    console.error('ERROR: ')
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)
    
    throw err
  }
}