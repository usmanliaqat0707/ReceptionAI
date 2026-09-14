export class TemplateEngineService {
  /**
   * Safely interpolates variables into a template string without executable eval or code injection.
   */
  public static render(
    template: string,
    variables: Record<string, string | number | null | undefined>
  ): string {
    if (!template) return "";

    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, varName) => {
      const value = variables[varName];
      if (value === undefined || value === null) {
        return "";
      }
      return String(value);
    });
  }

  /**
   * Extracts all variable names used in a template string.
   */
  public static extractVariables(template: string): string[] {
    if (!template) return [];
    const matches = template.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g);
    if (!matches) return [];
    return Array.from(
      new Set(matches.map((m) => m.replace(/[\{\}\s]/g, "")))
    );
  }

  /**
   * Validates that all variables used in a template are included in the allowed list.
   */
  public static validateVariables(
    template: string,
    allowedVariables: string[]
  ): { valid: boolean; disallowed: string[] } {
    const used = this.extractVariables(template);
    const allowedSet = new Set(allowedVariables);
    const disallowed = used.filter((v) => !allowedSet.has(v));
    return {
      valid: disallowed.length === 0,
      disallowed,
    };
  }

  /**
   * Sanitizes text to prevent HTML / script injection when used inside HTML emails.
   */
  public static sanitizeForHtml(text: string): string {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}
