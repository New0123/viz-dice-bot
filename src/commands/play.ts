import { getLatestLottery } from "../models/Lottery"
import { isParticipated } from "../models/Award"
import { Telegraf, Context } from "telegraf"

export function setupPlay(bot: Telegraf<Context>) {
  bot.command('play', async ctx => {
    ctx.replyWithHTML(ctx.i18n.t('something_wrong'))
  })
  bot.hears(new RegExp('♟ .*'), async ctx => {
    if (!ctx.dbuser.login) {
      ctx.dbuser.state = "waitLogin"
      ctx.dbuser.save()
      ctx.replyWithHTML(ctx.i18n.t('wait_login'), {
        disable_web_page_preview: true
      })
      return
    }

    const waitMinutes = parseInt(process.env.MINUTES)
    const waitDate = new Date(
      ctx.dbuser.payoutDate.getTime()
      + (waitMinutes * 60 * 1000)
    )
    const now = new Date()
    const waitDateToCompare = new Date(waitDate.getTime() - 3000)
    if (waitDateToCompare > now) {
      const between = timeUnitsBetween(now, waitDate)
      const minutes = between['minutes']
      const seconds = between['seconds']
      ctx.replyWithHTML(ctx.i18n.t('wait_play', {
        minutes: minutes,
        seconds: seconds
      }))
      return
    }

    var value: number, multiplier: number, participated: Boolean
    await Promise.all([
      ctx.replyWithDice({ emoji: ctx.dbuser.game }),
      getLatestLottery().then(lottery => isParticipated(ctx.dbuser.login, lottery.block))
    ])
      .then(result => {
        const msg = result[0]
        participated = result[1]
        var user = ctx.dbuser
        value = msg.dice.value
        multiplier = parseFloat(`0.${value}`)
        switch (msg.dice.emoji) {
          case "🎲": case "🎯": case "🎳": // [1 - 6]
            multiplier = multiplier * 1
            break
          case "🏀": case "⚽️": // [1 - 5]
            multiplier = multiplier * 1.25
            break
          case "🎰": // [1 - 64]
            switch (value) {
              case 1: // bars
                multiplier = 0.1
                break
              case 22: // plums
                multiplier = 2
                break
              case 43: // lemons
                multiplier = 3
                break
              case 64: // sevens
                multiplier = 5
                break
              default: // other cases
                multiplier = multiplier * 0.9
                break
            }
            break
        }
        if (user.value == msg.dice.value) {
          user.series += 1
        } else {
          user.series = 1
        }
        user.value = value

        const hours = parseInt(process.env.HOURS)
        const zeroingDate = new Date(
          user.payoutDate.getTime()
          + (hours * 60 * 60 * 1000)
        )
        if (now > zeroingDate) {
          user.payouts = 1
        } else {
          user.payouts = user.payouts + 1
        }

        if (participated) {
          multiplier = multiplier * 3
        }

        multiplier = multiplier / user.payouts

        user.payoutDate = now
        user.save()
        return ctx.viz.getAccount(process.env.ACCOUNT)
      })
      .then(account => {
        const baseEnergy = account['energy'] / 100
        const finalEnergy = ctx.dbuser.payouts < 100 ? Math.ceil(baseEnergy * multiplier * ctx.dbuser.series) : 0
        const memo = ctx.dbuser.game
        console.log(`Payout to ${ctx.dbuser.login} with energy ${finalEnergy}, multiplier ${multiplier}, payouts: ${ctx.dbuser.payouts}, series ${ctx.dbuser.series}`)
        return ctx.viz.makeAward(ctx.dbuser.login, memo, finalEnergy, ctx.dbuser.referrer, account)
      })
      .then(reward => {
        ctx.replyWithHTML(ctx.i18n.t('successful_payout', {
          reward: reward,
          user: ctx.dbuser.login,
          number: ctx.dbuser.value,
          series: ctx.dbuser.series,
          participated: participated,
          account: process.env.ACCOUNT
        }), {
          disable_web_page_preview: true,
          disable_notification: true
        })
      })
      .catch(err => {
        if (err.toString().search(/does not have enough energy to vote/) !== -1) {
          ctx.replyWithHTML(ctx.i18n.t('out_of_energy'))
          return
        }
        if (err.toString().search(/Duplicate transaction check failed/) !== -1) {
          ctx.replyWithHTML(ctx.i18n.t('too_fast'))
          return
        }
        if (err.toString().search(/Bad Gateway/) !== -1) {
          ctx.viz.changeNode()
        }
        console.log("Error: ", err.toString())
        ctx.replyWithHTML(ctx.i18n.t('something_wrong'))
      })
  })
}

function timeUnitsBetween(startDate: Date, endDate: Date) {
  let delta = Math.abs(endDate.getTime() - startDate.getTime()) / 1000
  const isNegative = startDate > endDate ? -1 : 1;
  const units: [[string, number], [string, number], [string, number], [string, number]] = [
    ['days', 24 * 60 * 60],
    ['hours', 60 * 60],
    ['minutes', 60],
    ['seconds', 1]
  ]
  return units.reduce((acc, [key, value]) => (acc[key] = Math.floor(delta / value) * isNegative, delta -= acc[key] * isNegative * value, acc), {})
}
