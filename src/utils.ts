import { Prisma } from './generated/prisma'

export interface Context {
  db: Prisma
  request: any
}
export const ENVCryptoSecret = 'MamaTestnetSecret-for-poc-only'
