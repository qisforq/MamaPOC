import { GraphQLServer } from 'graphql-yoga'
import { Prisma } from './generated/prisma'
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
import { resolvers } from './resolvers'
      
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
