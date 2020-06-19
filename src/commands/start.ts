import { Telegraf, Context } from "telegraf"
import { sendLanguageKeyboard } from "./language"

export function setupStart(bot: Telegraf<Context>) {
    bot.start((ctx) => {
        sendLanguageKeyboard(ctx)
        const payload = (ctx as any)['startPayload']
        const referrer = Buffer.from(payload, 'base64').toString()
        var user = ctx.dbuser
        if (!user.referrer && referrer) {
            ctx.viz.isAccountExists(referrer)
                .then(
                    result => {
                        if (result) {
                            user.referrer = referrer
                            user.save()
                        } else {
                            console.log('Refereer', referrer, 'doesn\'t exists')
                        }
                    },
                    err => console.log('Referrer error', referrer, err)
                )
        }
    })
}


