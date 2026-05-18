import {
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { IPaymentModuleService } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

/** GoPay notifies: GET /hooks/payment/pp_paykit_gopay?id={gopay_payment_id} */
export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> => {
  const providerId = (req.params as Record<string, string>)
    .provider_id;
  const paymentId = req.query.id as string | undefined;

  if (!paymentId) {
    console.warn(
      `[PayKit] GET webhook hit for ${providerId} but no ?id param`,
    );
    res.status(400).json({ message: 'Missing payment id' });
    return;
  }

  console.info(
    `[PayKit] GET webhook received for provider ${providerId}, payment id: ${paymentId}`,
  );

  const paymentModule = req.scope.resolve<IPaymentModuleService>(
    Modules.PAYMENT,
  );

  const sessions = await paymentModule.listPaymentSessions(
    { provider_id: providerId },
    { select: ['id', 'data', 'status'] },
  );

  const session = sessions.find(
    s => (s.data as Record<string, unknown>)?.id == paymentId,
  );

  if (!session) {
    console.warn(
      `[PayKit] GET webhook: no payment session found for payment id ${paymentId}`,
    );

    res.status(200).json({ received: true });
    return;
  }

  try {
    await paymentModule.authorizePaymentSession(session.id, {});
    console.info(
      `[PayKit] GET webhook: session ${session.id} authorized successfully`,
    );
  } catch (err: any) {
    console.error(
      `[PayKit] GET webhook: failed to authorize session ${session.id}:`,
      err?.message,
    );
  }

  res.status(200).json({ received: true });
};
