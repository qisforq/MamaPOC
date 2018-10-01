import { GraphQLServer } from 'graphql-yoga'
import { importSchema } from 'graphql-import'
import { Prisma } from './generated/prisma'
import { Context } from './utils'

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
    signup(parent, { username }, context: Context, info) {
      const data = {
        username,
        stellarAccount: '1234',
        stellarSeed: '1234'
      }
      return context.db.mutation.createUser({ data }, info)
    }
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
