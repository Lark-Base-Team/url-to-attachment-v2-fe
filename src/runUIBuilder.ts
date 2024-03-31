import { bitable, FieldType, checkers, IOpenAttachment, IOpenSegmentType, fieldEventPrefix, IWidgetField, IWidgetTable, IWidgetView } from "@lark-base-open/js-sdk";
import { downloadFile2 } from "./download";
import { saveAutomationConfig } from "./api";
// @ts-ignore
window.bitable = bitable;
let _errorLog: { [p: string]: string } = {};
const ISURLREG = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/;
const urlTokenCache = new Map();
//

export default async function main(uiBuilder: any, t: any = (s: string) => s) {
  const tenantKey = await bitable.bridge.getTenantKey();
  uiBuilder.markdown(`
### ${t("title")}
${t("title.desc")}
&nbsp;
`);
  uiBuilder.form(
    (form: any) => ({
      formItems: [
        form.input("PersonalBaseToken", { label: t("base.token") }),
        form.tableSelect("table", { label: t("choosed.table") }),
        form.viewSelect("view", { label: t("choosed.view"), sourceTable: "table" }),
        form.fieldSelect("urlField", {
          required: true,
          label: t("choosed.url"),
          filterByTypes: [FieldType.Text, FieldType.Url, FieldType.Lookup, FieldType.Formula],
          sourceTable: "table",
        }),
        form.fieldSelect("attachmentField", {
          label: t("choosed.att"),
          filterByTypes: [FieldType.Attachment],
          sourceTable: "table",
        }),
        form.checkboxGroup("cover", { label: "", options: [t("cover")], defaultValue: [] }),
      ],
      buttons: tenantKey === "736588c9260f175d" ? [t("ok"), t("saveAutomation")] : [t("ok")],
    }),
    async ({ key, values }: any) => {
      let {
        table,
        view,
        urlField,
        cover,
        attachmentField,
        PersonalBaseToken,
      }: {
        table: IWidgetTable;
        view: IWidgetView;
        urlField: IWidgetField;
        cover: any;
        attachmentField: IWidgetField;
        PersonalBaseToken: string;
      } = values;
      const tableId = table?.id;
      const urlFieldId = urlField?.id;
      const attachmentFieldId = attachmentField?.id;
      cover = cover.length ? true : false;
      if (!tableId || !urlFieldId || !attachmentFieldId || !PersonalBaseToken || !view) {
        uiBuilder.message.error(t("choosed.error"));
        return;
      }
      if (key === t("saveAutomation")) {
        uiBuilder.showLoading(" ");
        const tableName = await table.getName();
        const appToken = (await bitable.base.getSelection()).baseId;
        const urlFieldName = await urlField.getName();
        const attachmentFieldName = await attachmentField.getName();
        await saveAutomationConfig({
          app_token: appToken,
          config_name: t("automationConfigName", {
            tableName: tableName,
            urlFieldName: urlFieldName,
            attachmentFieldName: attachmentFieldName
          }) + (cover ? t("automationConfigName.cover") : ""),
          extension_id: "replit_3c5c253b1beae3e3",
          table_id: tableId,
          url_field_id: urlFieldId,
          attachment_field_id: attachmentFieldId,
          cover: cover,
        });
        uiBuilder.message.success(t("saveAutomation.success"));
        uiBuilder.hideLoading();
        return;
      }
      console.log(cover, "cover");
      const bitableurl = await bitable.bridge.getBitableUrl({ tableId: "ddd", viewId: "ddd" } as any);
      const _bitableurl = new URL(bitableurl);
      const domain = _bitableurl.host.includes(".feishu.") ? "Feishu" : "Lark";
      const appToken = _bitableurl.pathname.split("/").pop();

      uiBuilder.showLoading(" ");
      const urlFieldType = await urlField.getType();
      const viewRecordIds = await view.getVisibleRecordIdList();

      let urlValueList = await urlField.getFieldValueList();

      const attachmentValueList = await attachmentField.getFieldValueList();

      const attachmentValueListRecordIds = attachmentValueList.map((v) => v.record_id).flat(2);

      if (!cover) {
        urlValueList = urlValueList.filter(({ record_id }: any) => {
          return !attachmentValueListRecordIds.includes(record_id);
        });
      }

      urlValueList = urlValueList
        .filter(({ record_id }: any) => {
          return viewRecordIds.includes(record_id);
        })
        .sort((a, b) => viewRecordIds.indexOf(a.record_id ?? "") - viewRecordIds.indexOf(b.record_id ?? ""));

      console.log("===当前视图下的url", urlValueList);
      const totalCellCount = urlValueList.length;

      let current = 0;
      _errorLog = {};
      // @ts-ignore
      window._errorLog = _errorLog;
      for (let cellValue of urlValueList) {
        const progress = `${current}/${totalCellCount}`;
        current++;
        uiBuilder.showLoading(progress);
        const recordId = cellValue.record_id!;
        const value = cellValue.value;
        if (!value) {
          continue;
        }
        const urlList: string[] = [];
        if (Array.isArray(value)) {
          value.forEach((item: any) => {
            if (item.type === IOpenSegmentType.Url) {
              if (ISURLREG.test(item.link.trim())) {
                urlList.push(item.link.trim());
              }
            }
            if (item.type === IOpenSegmentType.Text) {
              if (ISURLREG.test(item.text.trim())) {
                urlList.push(item.text.trim());
              }
            }
          });
          if (!urlList.length) {
            _errorLog[current + t("unknown.url", { recordId })] = JSON.stringify(value);
            continue;
          }
          const datas = urlList.map((item: any) => {
            return {
              personalToken: PersonalBaseToken,
              appToken,
              brand: domain,
              url: item, // 需要下载的url
            };
          });

          const attachments: IOpenAttachment[] = (
            await Promise.all(
              datas.map(async (d, index) => {
                const file = await getAttachment(d);
                if ((file as IErrorLog)?.status === "error") {
                  const { url, error } = file as IErrorLog;
                  _errorLog[t("download.error", { url })] = error;
                  uiBuilder.message.error(t("download.error", { url, error }), 1.5);
                  return null;
                }
                return file as IOpenAttachment | null;
              })
            )
          ).filter((v) => v && v.token && v.timeStamp) as IOpenAttachment[];
          try {
            await table.setCellValue<IOpenAttachment[]>(attachmentFieldId, recordId, attachments);
          } catch (error) {
            console.log(error);
          }
        } else {
          _errorLog[current + t("unknown.url", { recordId })] = JSON.stringify(value);
        }
      }
      uiBuilder.hideLoading();
      setTimeout(() => {
        document.querySelector("html")?.scrollBy({ top: 0.5 * window.innerHeight, behavior: "smooth" });
      }, 1000);
      uiBuilder.message.success(t("end"));
      if (Object.keys(_errorLog).length) {
        uiBuilder.text(t("end.with.error"));
        for (const url in _errorLog) {
          uiBuilder.text(url + _errorLog[url] + "\n");
        }
      }
    }
  );
  if (tenantKey === "736588c9260f175d") {
    uiBuilder.markdown(`${t("betaInfo")}`);
  }
}

interface IErrorLog {
  status: "error";
  error: string;
  url: string;
}

async function getAttachment(data: any): Promise<IOpenAttachment | null | IErrorLog> {
  if (urlTokenCache.has(data.url)) {
    return urlTokenCache.get(data.url);
  }
  try {
    const attachment = await feDownloadFile(data.url);
    return attachment;
  } catch (error) {
    console.log("使用服务端下载", data.url);
    return beDownload({
      params: {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      },
    })
      .then((res) => {
        if (!res) {
          return {
            error: "未知错误",
            status: "error",
            url: data.url,
          };
        }
        return res.json().then((r) => {
          if (r.msg === "success") {
            delete r.msg;
            urlTokenCache.set(data.url, r);
            return r;
          }
          return {
            error: r.msg,
            status: "error",
            url: data.url,
          };
        });
      })
      .catch((error) => {
        return {
          error: String(error),
          status: "error",
          url: data.url,
        };
      });
  }
}

async function feDownloadFile(url: any): Promise<IOpenAttachment | null> {
  const file = await downloadFile2({ url, filename: new Date().getTime() + "" });
  const [token] = await bitable.base.batchUploadFile([file]);
  return {
    token,
    size: file.size,
    name: file.name,
    type: file.type,
    timeStamp: new Date().getTime(),
  };
}

/** 后端下载的模式 */
async function beDownload({ params }: { params: RequestInit }) {
  try {
    return await fetch("https://url-zhuan-fu-jian-v-2-hou-duan-lark-base.replit.app/upload/file", params);
  } catch {
    console.error("==后端1下载失败，尝试另一个接口");
    return await fetch("https://url-zhuan-fu-jian-v-2-hou-duan-lark-base.replit.app/upload/file", params);
  }
}
