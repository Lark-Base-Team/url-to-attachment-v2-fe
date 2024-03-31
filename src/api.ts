import axios from "axios";

export async function saveAutomationConfig(automationConfig: any) {
  const apiResp = await axios.post("https://connector.baseopendev.com/automation/save_config", automationConfig);
  return apiResp.data;
}
