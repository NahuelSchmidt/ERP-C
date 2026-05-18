import { getTenantDb } from "@/lib/get-tenant-db"
import { VAT_CONDITION_LABELS, DOCUMENT_TYPE_LABELS } from "@/lib/validations/customer"

export default async function ConfiguracionPage() {
  const db = await getTenantDb()

  const config = await db.tenantConfig.findFirst()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-0.5">Datos de la empresa</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 italic">Edición próximamente</span>
        </div>
      </div>

      {!config ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <p className="text-sm">No hay configuración registrada. Ejecutá el seed para inicializar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Datos empresa</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Razón social</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.companyName}</dd>
              </div>
              {config.tradeName && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Nombre comercial</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.tradeName}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Documento</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {DOCUMENT_TYPE_LABELS[config.documentType as keyof typeof DOCUMENT_TYPE_LABELS] ?? config.documentType}
                  {" "}
                  {config.documentNumber}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Condición IVA</dt>
                <dd className="text-sm text-gray-900 mt-0.5">
                  {VAT_CONDITION_LABELS[config.vatCondition as keyof typeof VAT_CONDITION_LABELS] ?? config.vatCondition}
                </dd>
              </div>
              {config.grossIncomeNumber && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Ing. brutos</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.grossIncomeNumber}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Dirección</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Calle</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.address ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Ciudad</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.city ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Provincia</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.state ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">País</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.country}</dd>
              </div>
              {config.postalCode && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Código postal</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.postalCode}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Configuración</h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-gray-400 uppercase font-medium">Moneda</dt>
                <dd className="text-sm text-gray-900 mt-0.5">{config.currency}</dd>
              </div>
              {config.timezone && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Zona horaria</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.timezone}</dd>
                </div>
              )}
              {config.phone && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Teléfono</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.phone}</dd>
                </div>
              )}
              {config.email && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Email</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.email}</dd>
                </div>
              )}
              {config.website && (
                <div>
                  <dt className="text-xs text-gray-400 uppercase font-medium">Sitio web</dt>
                  <dd className="text-sm text-gray-900 mt-0.5">{config.website}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
