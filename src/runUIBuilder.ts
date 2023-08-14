import { bitable, FieldType, checkers, IOpenAttachment, IOpenSegmentType } from "@base-open/web-api";
// @ts-ignore
window.bitable = bitable

const urlTokenCache = new Map()
//

export default async function main(uiBuilder: any, t = (s: string) => s) {
  uiBuilder.markdown(`
### ${t('title')}
${t('title.desc')}
&nbsp;
`);
  uiBuilder.form((form: any) => ({
    formItems: [
      form.input('PersonalBaseToken', { label: t('base.token') }),
      form.tableSelect('tableId', { label: t('choosed.table') }),
      form.fieldSelect('urlFieldId', {
        required: true, label: t('choosed.url'),
        filterByTypes: [FieldType.Text, FieldType.Url], sourceTable: 'tableId'
      }),
      form.fieldSelect('attachmentFieldId', {
        label: t('choosed.att'),
        filterByTypes: [FieldType.Attachment], sourceTable: 'tableId'
      }),
      form.checkboxGroup('cover', { label: '', options: [t('cover')], defaultValue: [] }),
    ],
    buttons: [t('ok')],
  }), async ({ values }: any) => {
    let { tableId, urlFieldId, cover, attachmentFieldId, PersonalBaseToken } = values;
    cover = cover.length ? true : false;
    if (!tableId || !urlFieldId || !attachmentFieldId || !PersonalBaseToken) {
      uiBuilder.message.error(t('choosed.error'))
      return;
    };
    console.log(cover, 'cover')
    const bitableurl = await bitable.bridge.getBitableUrl({ tableId: 'ddd', viewId: 'ddd' } as any)
    const _bitableurl = new URL(bitableurl)
    const domain = _bitableurl.host.includes('.feishu.') ? 'Feishu' : 'Lark';
    const appToken = _bitableurl.pathname.split('/').pop();


    uiBuilder.showLoading(' ');

    const table = await bitable.base.getTableById(tableId)
    const urlField = await table.getFieldById(urlFieldId)
    const urlFieldType = await urlField.getType();
    const urlValueList = await urlField.getFieldValueList();
    const totalCellCount = urlValueList.length;
    let current = 0;
    for (let cellValue of urlValueList) {
      uiBuilder.showLoading(`${current}/${totalCellCount}`);
      const recordId = cellValue.record_id!;
      if (!cover) {
        const attachment = await table.getCellString(attachmentFieldId, recordId);
        if (attachment) {
          continue;
        }
      }
      const value = cellValue.value
      if (!value) continue;
      const urlList: string[] = []
      if (Array.isArray(value)) {
        if (urlFieldType === FieldType.Url) {
          value.forEach((item: any) => {
            if (item.link?.includes?.('http')) {
              urlList.push(item.link)
            }
          })
        } else if (urlFieldType === FieldType.Text) {
          if (checkers.isSegments(value)) {
            value.forEach((item) => {
              if (item.type === IOpenSegmentType.Url) {
                if (item.link?.includes?.('http')) {
                  urlList.push(item.link)
                }
              }
            })
          }
        }
        if (!urlList.length) continue;
        const datas = urlList.map((item: any) => {
          return {
            personalToken: PersonalBaseToken,
            appToken,
            brand: domain,
            url: item, // 需要下载的url
          }
        })

        const attachments = (await Promise.all(datas.map((d) => getAttachment(d)))).filter((v) => v) as any;
        console.log(attachments)
        await table.setCellValue(attachmentFieldId, recordId, attachments)
        current++;
      }
    };
    uiBuilder.hideLoading()
    uiBuilder.message.success(t('end'))
  })
}



async function getAttachment(data: any): Promise<IOpenAttachment | null> {
  if (urlTokenCache.has(data.url)) {
    return urlTokenCache.get(data.url)
  }

  return fetch('https://url-zhuan-fu-jian-hou-duan-zheng-shi-lark-base.replit.app/upload/file', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  }).then((res) => {
    return res.json().then((r) => {
      if (r.msg === 'success') {
        delete r.msg;
        urlTokenCache.set(data.url, r)
        return r
      }
    })

  }).catch(() => {
    return null
  })
}