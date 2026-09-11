import { Link } from 'react-router-dom'

const sections = [
  {
    title: '1. Protección de Datos',
    body: 'AlquilaWeb se compromete a proteger la información personal y comercial proporcionada por el cliente. Todos los datos recopilados (incluyendo RUC, Razón Social, correos y contraseñas) son tratados bajo estricto cumplimiento de las leyes vigentes de Protección de Datos Personales. Tu información no será vendida ni compartida con terceros ajenos al servicio de alojamiento y desarrollo web.',
  },
  {
    title: '2. Condiciones de Pago (Adelanto del 50%)',
    body: 'Para iniciar cualquier proyecto de diseño, desarrollo o integración web, el cliente deberá abonar el 50% del total del plan o servicio contratado por adelantado. El equipo de AlquilaWeb no iniciará labores de ensamblaje ni diseño hasta que el comprobante de este pago inicial haya sido subido, validado y aprobado en el panel de control.',
  },
  {
    title: '3. Proceso de Aprobación y Revisiones',
    body: 'Una vez recibido el pago inicial y el material (fotos, carta, logos), nuestro equipo construirá el sitio web. Antes de ser publicado en su dominio final, se presentará una versión de prueba (vista previa) al cliente para su revisión y conformidad. El sitio solo pasará a producción (público) tras la aprobación del cliente.',
  },
  {
    title: '4. Política de Cancelación y No Devoluciones',
    body: 'Debido a la naturaleza digital del servicio y al tiempo invertido por nuestros desarrolladores desde el día uno, no existen devoluciones ni reembolsos del pago inicial. Si el cliente desiste del servicio, decide cancelar el proyecto a mitad del proceso, o manifiesta disconformidad injustificada tras la presentación del diseño basado en el material proporcionado, el 50% abonado inicialmente se retendrá en su totalidad como pago por los costos operativos y horas de trabajo ya ejecutadas.',
  },
  {
    title: '5. Pagos Atrasados y Continuidad del Servicio',
    body: [
      'El pago de la suscripción mensual o los módulos adicionales debe realizarse en las fechas de corte acordadas. Si el cliente presenta un retraso mayor a tres (3) días hábiles en la cancelación de su mensualidad, se aplicará automáticamente un recargo del 15% sobre el valor de su plan actual en concepto de penalidad por mora.',
      'El pago inmediato de este 15% es requisito obligatorio para mantener el sitio web en producción y evitar la suspensión de los servicios en línea. El saldo restante de la mensualidad deberá ser cancelado en su totalidad durante ese mismo ciclo de facturación. El incumplimiento prolongado derivará en la baja temporal del sitio web hasta la regularización de la deuda.',
      'Pagos Parciales y Fraccionamiento: Entendemos que pueden surgir imprevistos. En caso de no poder cancelar la totalidad de la deuda, el cliente podrá realizar un pago parcial o "adelanto". Todo abono parcial se destinará en primer lugar a cubrir el 15% de penalidad por mora.',
      'Para que el sitio web se mantenga activo bajo esta modalidad, el pago inicial deberá cubrir obligatoriamente la penalidad más, al menos, el 50% del valor de la mensualidad pendiente. El saldo restante deberá ser cancelado en un plazo máximo e improrrogable de quince (15) días calendario. De no completarse el pago en dicho periodo, se procederá con la suspensión inmediata del servicio.',
    ],
  },
]

function Terminos() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium mb-6"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Volver al Registro
        </Link>

        <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-3xl font-black text-slate-900 mb-8">
            Términos y Condiciones de Servicio
          </h1>

          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">
                {section.title}
              </h2>
              {(Array.isArray(section.body) ? section.body : [section.body]).map(
                (paragraph) => (
                  <p
                    key={paragraph}
                    className="text-slate-600 mb-4 leading-relaxed"
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Terminos