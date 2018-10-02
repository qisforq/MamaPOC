
import { Context } from '../utils'

export function user(_, { username }, context: Context, info){
  return context.db.query.user({ 
    where: { username } 
  }, info)
}