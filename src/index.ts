import { GraphQLServer } from 'graphql-yoga'
import { importSchema } from 'graphql-import'
import { Prisma } from './generated/prisma'
import { Context } from './utils'

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


const  ENVCryptoSecret = 'MamaTestnetSecret-for-poc-only'
      
// (root, args, context, info)
const resolvers = {
  Query: {
    user(_, { username }, context: Context, info){
      return context.db.query.user({ 
        where: { username } 
      }, info)
    }
  },
  Mutation: {
    async signup(_, { username }, context: Context, info) {
      const keypair = Keypair.random()
      const secret = AES.encrypt(keypair.secret(), ENVCryptoSecret).toString()
      console.log("secret: ", keypair.secret(), "secret+AES: ", secret)
      const data = {
        username,
        stellarAccount: keypair.publicKey(),
        stellarSeed: secret
      }

      const user = await context.db.mutation.createUser({ data }, info)

      // In a production app, you don't want to block to do this operation or have the keys to create accounts in this same app. Use something like AWS lambda, or a separate system to provision the Stellar account.

      try {
        // Tell the Stellar SDK you are using the testnet
        Network.useTestNetwork()
        // point to testnet host
        const stellarServer = new Server('https://horizon-testnet.stellar.org')

        // In poduction, don't put values like the account seed in code
        const provisionerKeyPair = Keypair.fromSecret('SA72TGXRHE26WC5G5MTNURFUFBHZHTIQKF5AQWRXJMJGZUF4XY6HFWJ4')

         // Load account from Stellar
        const provisioner = await stellarServer.loadAccount(provisionerKeyPair.publicKey())

        console.log('creating account in ledger', keypair.publicKey())

        const transaction = new TransactionBuilder(provisioner)
          .addOperation(
            Operation.createAccount({
              destination: keypair.publicKey(),
              startingBalance: '2'
            })
          ).build()

          // Sign the transaction above
          transaction.sign(provisionerKeyPair)
          
          // Submit transaction to the server
          const result = await stellarServer.submitTransaction(transaction)
          console.log('Account created: ' + result)
      } catch (e) {
        console.log('Stellar account note created.', e)
      }

      return user
    },
  },
}

const server = new GraphQLServer({
  typeDefs: './src/schema.graphql',
  resolvers,
  context: req => ({
    ...req,
    db: new Prisma({
      endpoint: 'https://us1.prisma.sh/quentin-94ece9/mama-poc/dev', // the endpoint of the Prisma API
      debug: true, // log all GraphQL queries & mutations sent to the Prisma API
      // secret: 'mysecret123', // only needed if specified in `database/prisma.yml`
    }),
  }),
})
server.start(() => console.log('Server is running on http://localhost:4000'))
