
import { Context } from '../utils'


export function info(root, args, context: Context, info){
  return "This is the API for Mama's user database"
}

export function user(_, { username }, context: Context, info){
  return context.db.query.user({ 
    where: { username } 
  }, info)
}

export function users(root, args, context: Context, info){
  return context.db.query.users({})
}
