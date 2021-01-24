import { prop, getModelForClass } from '@typegoose/typegoose'
import { DiceEmoji } from 'telegraf/typings/telegram-types'

export type UserState = 'waitLogin'

export class User {
  @prop({ required: true, index: true, unique: true })
  id: number

  @prop({ required: true, default: 'en' })
  language: string

  @prop({ required: false })
  state: UserState

  @prop({ required: true, enum: ['🎲', '🎯', '🏀', '⚽️', '🎰', '🎳'], default: '🎲' })
  game: DiceEmoji

  @prop({ required: true, default: 0 })
  value: number

  @prop({ required: true, default: 1 })
  series: number

  @prop({ required: false, unique: false })
  login: string

  @prop({ required: false })
  referrer: string

  @prop({ default: new Date(null) })
  payoutDate: Date

  @prop({ required: true, default: 1 })
  payouts: number
}

// Get User model
const UserModel = getModelForClass(User, {
  schemaOptions: { timestamps: true },
})

// Get or create user
export async function findUser(id: number) {
  let user = await UserModel.findOne({ id })
  if (!user) {
    try {
      user = await new UserModel({ id }).save()
    } catch (err) {
      console.log(err)
      user = await UserModel.findOne({ id })
    }
  }
  return user
}

export async function getActiveUsers(afterDate: Date) {
  return await UserModel.find({ updatedAt: { $gte: afterDate } })
}
