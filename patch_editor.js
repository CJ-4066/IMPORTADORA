const fs = require('fs');
let content = fs.readFileSync('src/components/admin/messages/automations/AutomationEditor.tsx', 'utf8');

content = content.replace(
  /<button className="button is-primary">([\s\S]*?)<\/button>/,
  `<button className="button is-primary" onClick={handlePublish} disabled={saving}>
            {saving ? <RefreshCw size={16} className="spin" /> : <Play size={16} />}
            <span>Publicar en n8n</span>
          </button>`
);

const publishFn = `
  const handlePublish = async () => {
    if (!data) return;
    setSaving(true);
    setError(null);
    
    const draftVersion = data.versions[0];
    try {
      // 1. Guardar primero
      await handleSave();
      
      // 2. Publicar
      const res = await fetch(\`/api/admin/automations/\${automationId}/publish\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftVersionId: draftVersion.id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      alert("Publicado con éxito");
      
      // Refrescar para cargar la nueva versión borrador
      const fresh = await fetch(\`/api/admin/automations/\${automationId}\`).then(r => r.json());
      setData(fresh);
    } catch (e: any) {
      setError(e.message || "Error al publicar");
    } finally {
      setSaving(false);
    }
  };
`;

content = content.replace(
  /const handleSave = async \(\) => {/,
  `${publishFn}\n\n  const handleSave = async () => {`
);

fs.writeFileSync('src/components/admin/messages/automations/AutomationEditor.tsx', content);
