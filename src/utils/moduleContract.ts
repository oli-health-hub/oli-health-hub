import { contactReception } from './whatsapp';
import type { OLIModule } from '../models/modules';

/**
 * Decide como iniciar a contratação de um módulo: checkout in-app só quando
 * há formulário e preço definidos (in_app_form + amount). Todo o resto —
 * contact_sales, oauth ainda sem self-service, preço "a definir" — vai pro
 * WhatsApp da recepção. Fonte única pra essa regra (usada em /modulos e na
 * aba Ecossistema) evitar as duas telas divergindo de novo.
 */
export async function contractModule(
  module: OLIModule,
  openCheckout: (module: OLIModule) => void,
): Promise<void> {
  if (module.activationType === 'in_app_form' && module.pricing.amount !== undefined) {
    openCheckout(module);
    return;
  }
  await contactReception(
    `Olá! Tenho interesse em contratar o módulo *${module.name}* (${module.provider}). Poderia me passar mais informações?`
  );
}
