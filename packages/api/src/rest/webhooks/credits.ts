import type { Stripe } from 'stripe'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import hash from 'stable-hash'

import { eq } from '@cared/db'
import { db } from '@cared/db/client'
import { Credits, CreditsOrder } from '@cared/db/schema'
import log from '@cared/log'

import { getStripe } from '../../client/stripe'
import { env } from '../../env'

export async function POST(req: Request) {
  const stripe = getStripe()

  let event: Stripe.Event

  if (env.STRIPE_WEBHOOK_SECRET) {
    try {
      const stripeSignature = (await headers()).get('stripe-signature')
      if (!stripeSignature) {
        return NextResponse.json(
          { message: 'Payment webhook error: Missing stripe-signature header' },
          { status: 400 },
        )
      }

      event = stripe.webhooks.constructEvent(
        await req.text(),
        stripeSignature,
        env.STRIPE_WEBHOOK_SECRET,
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.log(`❌ Payment webhook error: ${errorMessage}`)
      return NextResponse.json(
        { message: `Payment webhook error: ${errorMessage}` },
        { status: 400 },
      )
    }
  } else {
    event = (await req.json()) as Stripe.Event
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired':
        {
          const session = event.data.object
          log.info(
            `Received checkout session event: ${event.type} for checkout session with id ${session.id}`,
          )

          await db.transaction(async (tx) => {
            const order = (
              await tx
                .select()
                .from(CreditsOrder)
                .where(eq(CreditsOrder.objectId, session.id))
                .for('update')
            )[0]

            if (order) {
              if (hash(order.object) !== hash(session)) {
                await tx
                  .update(CreditsOrder)
                  .set({
                    object: session,
                  })
                  .where(eq(CreditsOrder.id, order.id))
              }

              if (
                (event.type === 'checkout.session.completed' ||
                  event.type === 'checkout.session.async_payment_succeeded') &&
                session.mode === 'payment' &&
                session.status === 'complete' &&
                session.payment_status === 'paid' &&
                order.status !== 'complete'
              ) {
                const delta = session.line_items?.data.find(
                  (lineItem) => lineItem.price?.id === env.STRIPE_CREDITS_PRICE_ID,
                )?.quantity

                if (delta) {
                  const credits = (
                    await tx
                      .select()
                      .from(Credits)
                      .where(eq(Credits.userId, order.userId))
                      .for('update')
                  )[0]

                  if (credits) {
                    await tx
                      .update(Credits)
                      .set({
                        credits: credits.credits + delta,
                        metadata: {
                          ...credits.metadata,
                          isRechargeInProgress: false,
                        },
                      })
                      .where(eq(Credits.userId, order.userId))
                  } else {
                    log.error(`Credits not found for user with id ${order.userId}`)
                  }
                } else {
                  log.error(
                    `Line item not found for checkout session with id ${session.id}`,
                    session,
                  )
                }
              }
            } else {
              log.error(`Order not found for checkout session with id ${session.id}`)
            }
          })
        }
        break
      case 'invoice.created':
      case 'invoice.deleted':
      case 'invoice.finalization_failed':
      case 'invoice.finalized':
      case 'invoice.marked_uncollectible':
      case 'invoice.overdue':
      case 'invoice.overpaid':
      case 'invoice.paid':
      case 'invoice.payment_action_required':
      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded':
      case 'invoice.sent':
      case 'invoice.upcoming':
      case 'invoice.updated':
      case 'invoice.voided':
      case 'invoice.will_be_due':
        {
          const invoice = event.data.object
          log.info(`Received invoice event: ${event.type} for invoice with id ${invoice.id}`)

          await db.transaction(async (tx) => {
            const order = (
              await tx
                .select()
                .from(CreditsOrder)
                .where(eq(CreditsOrder.objectId, invoice.id!))
                .for('update')
            )[0]

            if (order) {
              if (hash(order.object) !== hash(invoice)) {
                await tx
                  .update(CreditsOrder)
                  .set({
                    object: invoice,
                  })
                  .where(eq(CreditsOrder.id, order.id))
              }

              if (
                (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') &&
                invoice.status === 'paid' &&
                order.status !== 'paid'
              ) {
                /* const delta = invoice.lines.data.find(
          (lineItem) =>
            lineItem.pricing?.price_details?.price === env.STRIPE_CREDITS_PRICE_ID,
        )?.quantity */
                const delta = invoice.amount_paid / 100

                const credits = (
                  await tx
                    .select()
                    .from(Credits)
                    .where(eq(Credits.userId, order.userId))
                    .for('update')
                )[0]

                if (credits) {
                  await tx
                    .update(Credits)
                    .set({
                      credits: credits.credits + delta,
                      metadata: {
                        ...credits.metadata,
                        isRechargeInProgress: false,
                      },
                    })
                    .where(eq(Credits.userId, order.userId))
                } else {
                  log.error(`Credits not found for user with id ${order.userId}`)
                }
              }
            } else {
              log.error(`Order not found for invoice with id ${invoice.id}`)
            }
          })
        }
        break
      default:
        throw new Error(`Unhandled event: ${event.type}`)
    }
  } catch (error) {
    console.log(error)
    return NextResponse.json({ message: 'Webhook handler failed' }, { status: 500 })
  }

  // Return a response to acknowledge receipt of the event.
  return NextResponse.json({ message: 'Received' }, { status: 200 })
}
