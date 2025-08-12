import {
  ArrayFieldTemplateProps,
  BaseInputTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
} from '@rjsf/utils';
import { Button } from '@op/ui/Button';

export const FieldTemplate = (props: FieldTemplateProps) => {
  const { children, rawErrors } = props;
  
  return (
    <div className="mb-4">
      {children}
      {rawErrors && rawErrors.length > 0 && (
        <div className="mt-1 text-xs text-red-500">
          {rawErrors.join(', ')}
        </div>
      )}
    </div>
  );
};

export const ObjectFieldTemplate = (props: ObjectFieldTemplateProps) => {
  const { properties, title, description } = props;
  
  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-base font-medium text-neutral-charcoal">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-neutral-gray4">{description}</p>
      )}
      {properties.map((prop: any) => prop.content)}
    </div>
  );
};

export const ArrayFieldTemplate = (props: ArrayFieldTemplateProps) => {
  const { items, canAdd, onAddClick, title, schema } = props;
  
  return (
    <div className="space-y-4">
      {title && (
        <label className="text-sm font-medium text-neutral-charcoal">{title}</label>
      )}
      {schema.description && (
        <p className="text-xs text-neutral-gray4">{schema.description}</p>
      )}
      <div className="space-y-2">
        {items.map((element: any) => (
          <div key={element.key} className="flex items-center gap-2">
            <div className="flex-1">{element.children}</div>
            {element.hasRemove && (
              <Button
                size="small"
                variant="primary"
                onPress={element.onDropIndexClick(element.index)}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      {canAdd && (
        <Button
          size="small"
          variant="primary"
          onPress={onAddClick}
        >
          Add {title?.toLowerCase() || 'item'}
        </Button>
      )}
    </div>
  );
};

export const BaseInputTemplate = (props: BaseInputTemplateProps) => {
  return <>{props.children}</>;
};

export const CustomTemplates = {
  FieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  BaseInputTemplate,
};