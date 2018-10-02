import { Context } from '../utils'
import { ENVCryptoSecret } from './index'

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
  const keypair = Keypair.random()
  const secret = AES.encrypt(keypair.secret(), ENVCryptoSecret).toString()
  console.log("secret: ", keypair.secret(), "secret+AES: ", secret)
  const data = {
    username,
    stellarAccount: keypair.publicKey(),
    stellarSeed: secret
  }

  const user = await context.db.mutation.createUser({ data }, info)

  // In production, you don't want to block to do this operation or have the keys to create accounts in this same app. Use something like AWS lambda, or a separate system to provision the Stellar account.

  try {
    // Tell the Stellar SDK you are using the testnet
    Network.useTestNetwork()
    // point to testnet host
    const stellarServer = new Server('https://horizon-testnet.stellar.org')

    // In poduction, don't put values like the account seed in code
    const provisionerKeyPair = Keypair.fromSecret('SA72TGXRHE26WC5G5MTNURFUFBHZHTIQKF5AQWRXJMJGZUF4XY6HFWJ4')

      // Load account from Stellar
    const provisioner = await stellarServer.loadAccount(provisionerKeyPair.publicKey())

    console.log('Creating new account in ledger with public key: ', keypair.publicKey())

    const transaction = new TransactionBuilder(provisioner)
      .addOperation(
        Operation.createAccount({
          destination: keypair.publicKey(),
          startingBalance: '1034'
        })
      ).build()

      // Sign the transaction above
      transaction.sign(provisionerKeyPair)
      
      // Submit transaction to the server
      const result = await stellarServer.submitTransaction(transaction)
      console.log('Account created! -> ' + JSON.stringify(result, null, 3))
  } catch (e) {
    console.log('Stellar account not created.', e)
  }
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