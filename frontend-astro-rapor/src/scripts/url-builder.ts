/**
 * Parses the stringified JSON value and constructs a Google Sheets URL.
 */
export function constructGSheetUrl(valueString: string): string {
  try {
    if (!valueString) return '#';
    const value = JSON.parse(valueString);
    if (!value.gsheetId || typeof value.gid === 'undefined') {
      console.warn('Incomplete data for URL construction: gid is missing.', value);
      return '#';
    }
    const baseUrl = `https://docs.google.com/spreadsheets/d/${value.gsheetId}/edit`;
    const fragment = `#gid=${value.gid}`;
    return `${baseUrl}${fragment}`;
  } catch (e) {
    console.error('Error parsing value string:', valueString, e);
    return '#';
  }
}
