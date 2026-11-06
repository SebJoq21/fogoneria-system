import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

type OrderItemShape = {
  tipo?: string;
  platoId?: string | null;
  comboId?: string | null;
};

/**
 * Un ítem PLATO debe traer `platoId` y no `comboId`; un COMBO, lo contrario.
 * Sin esta regla el servicio aceptaría líneas sin referencia o con ambas.
 */
export function IsConsistentOrderItem(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isConsistentOrderItem',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const item = args.object as OrderItemShape;
          if (item.tipo === 'PLATO') {
            return Boolean(item.platoId) && !item.comboId;
          }
          if (item.tipo === 'COMBO') {
            return Boolean(item.comboId) && !item.platoId;
          }
          return false;
        },
        defaultMessage(args: ValidationArguments) {
          const item = args.object as OrderItemShape;
          if (item.tipo === 'PLATO') {
            return 'Un ítem PLATO requiere platoId y no debe traer comboId';
          }
          if (item.tipo === 'COMBO') {
            return 'Un ítem COMBO requiere comboId y no debe traer platoId';
          }
          return 'El ítem debe ser de tipo PLATO o COMBO';
        },
      },
    });
  };
}
