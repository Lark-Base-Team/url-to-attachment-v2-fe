import { bitable, FieldType, checkers, IOpenAttachment, IOpenSegmentType, fieldEventPrefix, IField, ITable, IView, FilterOperator, FilterConjunction } from "@lark-base-open/js-sdk";
import { downloadFile2 } from "./download";
import { saveAutomationConfig } from "./api";
import { batchUploadFileByQ, isUrl } from "./utils";
import { fileTypeByContentType } from "./fileType";
// @ts-ignore
window.bitable = bitable;
let _errorLog: { [p: string]: string } = {};
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
        form.input("PersonalBaseToken", { label: <div>{t("base.token")}<span className="form-items-required-icon">*</span></div> }),
        form.tableSelect("table", { label: <div>{t("choosed.table")}<span className="form-items-required-icon">*</span></div> }),
        form.viewSelect("view", { label: <div>{t("choosed.view")}<span className="form-items-required-icon">*</span></div>, sourceTable: "table" }),
        form.fieldSelect("urlField", {
          required: true,
          label: <div>{t("choosed.url")}<span className="form-items-required-icon">*</span></div>,
          filterByTypes: [FieldType.Text, FieldType.Url, FieldType.Lookup, FieldType.Formula],
          sourceTable: "table",
        }),
        form.fieldSelect("attachmentField", {
          label: <div>{t("choosed.att")}<span className="form-items-required-icon">*</span></div>,
          filterByTypes: [FieldType.Attachment],
          sourceTable: "table",
        }),
        form.input("fileExName", { label: t("file.name") }),
        form.checkboxGroup("cover", { label: "", options: [t("cover")], defaultValue: [] }),
      ],
      //   buttons: tenantKey === "736588c9260f175d" ? [t("ok"), t("saveAutomation")] : [t("ok")],
      buttons: [t("ok")],
    }),
    async ({ key, values }: any) => {
      let {
        table,
        view,
        urlField,
        cover,
        attachmentField,
        fileExName = '',
        PersonalBaseToken,
      }: {
        table: ITable;
        view: IView;
        urlField: IField;
        cover: any;
        fileExName: string;
        attachmentField: IField;
        PersonalBaseToken: string;
      } = values;
      const tableId = table?.id;
      fileExName = fileExName.trim();
      fileExName = fileExName.startsWith('.') ? fileExName.slice(1) : `${fileExName}`;
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
      const appToken = (await bitable.base.getSelection()).baseId;

      uiBuilder.showLoading(" ");
      _errorLog = {};
      // @ts-ignore
      window._errorLog = _errorLog;
      const urlFieldType = await urlField.getType();
      /** 需要下载url并覆盖附件的记录id列表 */
      let recordIds: string[] = [];
      let hasMore = true;
      let totalCellCount: number | undefined = undefined;
      let nextPageToken: any = undefined;
      /** 已经处理的记录 */
      let current: number = 0;
      /** 过滤出url是否包含http */
      let urlContainsHttpFilter = null;

      if (urlFieldType !== FieldType.Url) {
        urlContainsHttpFilter = ({
          fieldId: urlFieldId,
          operator: FilterOperator.Contains,
          value: 'http',
        });
      }
      if (urlFieldType === FieldType.Formula || urlFieldType === FieldType.Lookup) {
        const proxyType = await urlField.getProxyType();
        if (proxyType === FieldType.Url) {
          urlContainsHttpFilter = null;
        }
      }

      /** 附件字段是否过滤出空的记录 */
      let attachmentIfEmptyFilter = cover ? null : ({
        fieldId: attachmentFieldId,
        operator: FilterOperator.IsEmpty,
      });
      const filter: any = {
        conditions: [
          urlContainsHttpFilter,
          {
            fieldId: urlFieldId,
            operator: FilterOperator.IsNotEmpty,
          },
          attachmentIfEmptyFilter
        ].filter((v) => v),
        conjunction: FilterConjunction.And
      };
      while (hasMore) {
        const { pageToken, total: currentPageTotal, recordIds, hasMore: _hasMore } = await view.getVisibleRecordIdListByPage({
          pageToken: attachmentIfEmptyFilter ? undefined : nextPageToken,
          filter
        });

        hasMore = _hasMore;
        nextPageToken = pageToken;
        if (!totalCellCount) {
          totalCellCount = currentPageTotal;
        }
        for (let index = 0; index < recordIds.length; index++) {
          const recordId = recordIds[index];
          const value = await table.getCellValue(urlFieldId, recordId);

          const progress = `${current}/${totalCellCount}`;
          current++;
          uiBuilder.showLoading(progress);
          if (!value) {
            continue;
          }
          const urlList: string[] = [];
          if (Array.isArray(value)) {
            value.forEach((item: any) => {
              if (item.type === IOpenSegmentType.Url) {
                if (isUrl(item.link.trim())) {
                  urlList.push(item.link.trim());
                }
              }
              if (item.type === IOpenSegmentType.Text) {
                if (isUrl(item.text.trim())) {
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
                fileExName,
                brand: domain,
                url: item, // 需要下载的url
              };
            });

            const attachments: IOpenAttachment[] = (
              await Promise.all(
                datas.map(async (d, index) => {
                  const file = await getAttachment(d);
                  console.log('===file', file);
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
}

interface IErrorLog {
  status: "error";
  error: string;
  url: string;
}

async function getAttachment(data: any): Promise<IOpenAttachment | null | IErrorLog> {
  const getRes = async (): Promise<IOpenAttachment | null | IErrorLog> => {

    if (urlTokenCache.has(data.url)) {
      return urlTokenCache.get(data.url);
    }
    try {
      const attachment = await feDownloadFile(data.url, {
        fileExName: data.fileExName,
      });
      urlTokenCache.set(data.url, attachment);
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

  const res = await getRes();
  return res;
}


async function feDownloadFile(url: any, options?: { fileExName?: string }): Promise<IOpenAttachment | null> {
  const file = await downloadFile2({ url, filename: new Date().getTime() + "", fileExName: options?.fileExName || '' });
  const [token] = await batchUploadFileByQ([file]);
  const res = {
    token,
    size: file.size,
    name: file.name,
    type: file.type,
    timeStamp: new Date().getTime(),
  }
  return res;
}

/** 后端下载的模式 */
async function beDownload({ params }: { params: RequestInit }) {
  const { url } = JSON.parse(params.body as string || "{}");
  try {
    return await fetch("https://connector.baseopendevx.com/url-convert/upload/file", params);
  } catch (error) {
    console.error("==后端1下载失败，尝试另一个接口");
    return {
      async json() {
        return {
          status: "error",
          error: String(error),
          url,
          msg: String(error),
        }
      }

    }
  }
}
