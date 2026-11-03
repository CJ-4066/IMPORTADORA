# Objetivo activo: catálogo de Meta Business Agent

1. Importar y mantener los productos vigentes con stock desde la tienda virtual.
2. Completar nombre, precio unitario, precio por mayor desde 3 unidades, especificaciones técnicas, URL y foto oficial.
3. Identificar duplicados por código de producto (y, si falta el código, por coincidencia clara de título y precio).
4. **Eliminar todos los duplicados autorizados por el administrador**, conservando el registro válido/enriquecido con imagen y datos completos.
5. No eliminar un registro válido si no se ha verificado primero que existe otro duplicado equivalente.
6. Registrar cada eliminación y cada pendiente localmente, y continuar con el siguiente producto sin pedir confirmación.
- **Validación obligatoria antes de crear:** buscar el código/SKU exacto en el catálogo de Meta antes de abrir o guardar un producto. Si ya existe, omitirlo y registrarlo como omitido por duplicado; solo crear otro registro cuando la tienda identifique explícitamente una variante distinta.
## Regla adicional de imagen

Antes de guardar cada producto, descargar la imagen oficial desde la tienda o servidor, convertirla a un formato aceptado por Meta (JPEG/PNG si es necesario), adjuntarla desde una carpeta local administrada y verificar que el formulario muestre la imagen adjunta. No guardar el producto si la imagen no queda confirmada.
