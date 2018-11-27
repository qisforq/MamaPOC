import {
  Context,
  allowTrust,
  createAccountInLedger,
  createTrustline,
  payment,
  ENVCryptoSecret,
  mamaUSDBankKeypair,
  mamaUSDKeyIssuerPubKey,
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
  await payment(mamaUSDBankKeypair, userKeypair.publicKey(),'50', `Here's $50 MamaUSD as a gift`)
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

  // const [recipient, sender] = result
  // ^^ an array with the sender and recipient's info (id, username, stellar account info) in object form 
  // NOTE: Recipient info comes first for some reason.
  // NOTE: THIS might not be true!! Use code below instead:
  // TODO: test this and implement:
  const sender = result.find((el)=> el.username === senderUsername)
  const recipient = result.find((el)=> el.username === recipientUsername)

  const signerKeys = Keypair.fromSecret(
    // In production, use something like KMS
    AES.decrypt(sender.stellarSeed, ENVCryptoSecret).toString(enc.Utf8)
  )
  
  try {
    const { hash } = await payment(signerKeys, recipient.stellarAccount, amount, memo)
    console.log("Payment successfully made!", hash);
    
    return { id: hash, memo: memo || null }
  } catch (err) {
    console.error('ERROR: ')
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)
    
    throw err
  }
}

// CREDIT MUTATION - for issuing more USD to a user, like if they deposit more money from their credit card
export async function creditUser(_, { amount, username }, context: Context, info) {
  const user = await context.db.query.user({
    where: {
      username
    }
  })

  try {
    const { hash } = await payment(mamaUSDBankKeypair, user.stellarAccount, amount)
    return { id: hash }
  } catch (err) {
    console.error('ERROR: ')
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)
  }
}

// DEBIT MUTATION - for debiting USD from a use, like if they withdraw money back into their bank account
export async function debitUser(_, { amount, username }, context: Context, info){
  const user = await context.db.query.user({
    where: {
      username,
    }
  })

  const keypair = Keypair.fromSecret(AES.decrypt(user.stellarSeed, ENVCryptoSecret).toString(enc.Utf8))

  try {
    const { hash } = await payment(keypair, mamaUSDKeyIssuerPubKey, amount)

    console.log(`account ${keypair.publicKey()} debited - ${username} should receive $${amount} USD in their bank account in 2-3 trillion days. Beep boop. Zorpazorp.`)

    return { id: hash }
  } catch (err) {
    console.error('ERROR: ')
    console.log(`extras.result_codes:`)
    console.log(err.response.data.extras.result_codes)
  }
}