import { bitable, FieldType, checkers, IOpenAttachment, IOpenSegmentType, fieldEventPrefix } from "@lark-base-open/js-sdk";
import { downloadFile2 } from "./download";
// @ts-ignore
window.bitable = bitable

const ISURLREG = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/
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
            form.tableSelect('table', { label: t('choosed.table') }),
            form.fieldSelect('urlField', {
                required: true, label: t('choosed.url'),
                filterByTypes: [FieldType.Text, FieldType.Url, FieldType.Lookup, FieldType.Formula], sourceTable: 'table'
            }),
            form.fieldSelect('attachmentField', {
                label: t('choosed.att'),
                filterByTypes: [FieldType.Attachment], sourceTable: 'table'
            }),
            form.checkboxGroup('cover', { label: '', options: [t('cover')], defaultValue: [] }),
        ],
        buttons: [t('ok')],
    }), async ({ values }: any) => {
        let { table, urlField, cover, attachmentField, PersonalBaseToken } = values;
        const tableId = table?.id
        const urlFieldId = urlField?.id
        const attachmentFieldId = attachmentField?.id
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
                value.forEach((item) => {
                    if (item.type === IOpenSegmentType.Url) {
                        if (ISURLREG.test(item.link)) {
                            urlList.push(item.link)
                        }
                    }
                    if (item.type === IOpenSegmentType.Text) {
                        if (ISURLREG.test(item.text)) {
                            urlList.push(item.text)
                        }
                    }
                })
                if (!urlList.length) continue;
                const datas = urlList.map((item: any) => {
                    return {
                        personalToken: PersonalBaseToken,
                        appToken,
                        brand: domain,
                        url: item, // 需要下载的url
                    }
                })

                const attachments = (await Promise.all(datas.map(async (d, index) => {
                    return getAttachment(d)
                }))).filter((v) => v && v.token && v.timeStamp)
                try {
                    await table.setCellValue(attachmentFieldId, recordId, attachments)
                } catch (error) {
                    console.log(error)
                }
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
    try {
        const attachment = await feDownloadFile(data.url)
        return attachment
    } catch (error) {
        console.log('使用服务端下载', data.url)
        return beDownload({
            params: {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        }).then((res) => {
            if (!res) {
                throw 'error'
            }
            return res.json().then((r) => {
                if (r.msg === 'success') {
                    delete r.msg;
                    urlTokenCache.set(data.url, r)
                    return r
                }
                return null
            })

        }).catch(() => {
            return null
        })
    }
}

async function feDownloadFile(url: any): Promise<IOpenAttachment | null> {
    const file = await downloadFile2({ url, filename: new Date().getTime() + '' })
    const [token] = await bitable.base.batchUploadFile([file])
    return {
        token,
        size: file.size,
        name: file.name,
        type: file.type,
        timeStamp: new Date().getTime()
    }
}

/** 后端下载的模式 */
async function beDownload({ params }: { params: RequestInit }) {
    try {
        return await fetch('https://urlzhuan-fu-jian-v2-hou-duan.lark-base.repl.co/upload/file', params);
    } catch {
        console.error('==后端1下载失败，尝试另一个接口');
        return await fetch('https://url-zhuan-fu-jian-v-2-hou-duan-lark-base.replit.app/upload/file', params);
    }
}