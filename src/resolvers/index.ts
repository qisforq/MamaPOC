import { Context } from '../utils'

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
// import schema from './schema/'

import { user } from './queries'
import { signupUser, makePayment } from './mutations'

export const ENVCryptoSecret = 'MamaTestnetSecret-for-poc-only'
  
// (root, args, context, info)  
  export const resolvers = {
    Query: {
      user
    },
    Mutation: {
      signupUser,
      makePayment
    },
  }