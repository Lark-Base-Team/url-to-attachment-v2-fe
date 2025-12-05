import { contentTypeExtension, fileTypeByContentType } from "./fileType";

/** 文件下载的缓存，后续支持多个并发下载的时候有用，现在没啥用 */
const downloadFileCache: {
    [p: string]: {
        success?: boolean,
        /** success之后将会变成undefined */
        xhr: XMLHttpRequest,
        file?: File
    }
} = {}


/** 后续支持多个并发下载的时候有用;重复的文件不下进行下载,将每秒检查一下重复的文件下载好了没有，然后resolve */
function checkCache(res: any, url: string) {
    setTimeout(() => {
        if (downloadFileCache[url].success) {
            res(downloadFileCache[url].file)
        } else {
            checkCache(res, url)
        }
    }, 1000);
}

/** 替换掉文件中不可作为文件名的字符 */
function replaceInvalidCharsInUrl(url: string) {
    // 匹配非字母数字、点、下划线、破折号的字符
    const invalidCharRegex = /[^a-zA-Z0-9.\-_]/g;
    // 将匹配到的字符替换为下划线
    return url.replace(invalidCharRegex, '_');
}


function includesFileExtension(string: string) {
    // 使用正则表达式检查字符串是否以 "." 字符开头，且后面跟着一个或多个字母
    var regex = /.*\.[a-zA-Z0-9]+$/;
    return regex.test(string);
}
function getURLFingerprint(url: string) {
    let hash = 0;

    if (url.length == 0) {
        return hash;
    }

    for (let i = 0; i < url.length; i++) {
        let char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Convert hash to string and trim to 20 characters
    return hash.toString().slice(0, 20);
}

interface DownloadFile { url: string, filename: string, fileExName: string }
export function downloadFile2({ url, filename, fileExName }: DownloadFile): Promise<File> {
    if (downloadFileCache[url]) {
        // 后续支持多文件并发下载的时候才有效;如果文件已经下载好了
        return new Promise((res) => {
            checkCache(res, url)
        })
    }

    // fetch下载文件
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch(url); // ignore_security_alert_wait_for_fix SSRF
            if (!response.ok) {
                reject(new Error(`文件下载失败. Response status: ${response.status}.`));
                return;
            }
            const contentType = response.headers.get('content-type') || '';
            let pre = (url.split('?')[1]?.slice?.(0, 10) || '') + getURLFingerprint(url)
            /** 最终给文件的拓展名 */
            let ex = contentTypeExtension[contentType] || contentTypeExtension[contentType.split(';')[0]] || ''

            if (!ex) {
                ex = `.${fileExName}`;
            }
            const blob = await response.blob();
            if (!blob?.size) {
                reject(new Error(`文件下载失败. Response status: ${response.status}.`));
                return;
            }
            console.log('构造文件:', {
                filename,
                ex,
                contentType,
                fileExName
            }
            )
            const file = new File([blob], replaceInvalidCharsInUrl(pre + filename + ex), { type: contentType });
            console.log('===file', file)
            resolve(file)
        } catch (error) {
            reject(error)
        }

    })

    // 另一种可选的下载方案，会触发浏览器下载文件到磁盘
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        downloadFileCache[url] = {
            xhr,
        }
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onload = () => {
            if (xhr.status === 200) {
                const blob = xhr.response;
                const file = new File([blob], filename, { type: blob.type });
                const blobUrl = URL.createObjectURL(file);
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = blobUrl;
                document.body.appendChild(iframe);
                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                    document.body.removeChild(iframe);
                    downloadFileCache[url] = {
                        file,
                        success: true,
                        xhr: undefined as any
                    }
                    resolve(file);
                }, 1000);
            } else {
                reject(new Error(`Failed to download file (status: ${xhr.status})`));
            }
        };
        xhr.onerror = () => {
            reject(new Error('Failed to download file'));
        };
        // if (onProgress) {
        //     xhr.onprogress = event => {
        //         if (event.lengthComputable) {
        //             const percentComplete = +(event.loaded / event.total).toFixed(2);
        //             onProgress(percentComplete);
        //         }
        //     };
        // }
        xhr.send();
    });
};

