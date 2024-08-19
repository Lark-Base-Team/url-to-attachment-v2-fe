import { bitable } from "@lark-base-open/js-sdk";
import { Subject } from 'rxjs';

export function isUrl(url: string) {
  try {
    new URL(url);
    return true
  } catch (error) {
    return false;
  }
}

let batchUploadFileQueue: File[][] | FileList[] | null[] = [];

class BatchUploadFileByQManage {
  subject = new Subject<number>();


  uploadByQ(file: File[] | FileList) {
    const index = batchUploadFileQueue.length;
    batchUploadFileQueue[index] = file;
    return this.task(index)
  }
  nextIndex = 0;

  task(index: number) {
    const result: Promise<string[]> = new Promise((res, rej) => {
      const unsubscribe = this.subject.subscribe({
        next: async (value) => {
          const files = batchUploadFileQueue[index];
          if (index === value && files) {

            const next = value + 1
            unsubscribe.unsubscribe();
            try {

              const token = await bitable.base.batchUploadFile(files);

              batchUploadFileQueue[value] = null
              if (batchUploadFileQueue[next]) {

                this.subject.next(next);
              } else {
                this.nextIndex = next;
              }
              res(token);
            } catch (error) {

              if (batchUploadFileQueue[next]) {

                this.subject.next(next);
              } else {
                this.nextIndex = next;
              }
              rej(error);
            }
          }
        },
      })
    });
    if (index === this.nextIndex) {

      this.subject.next(this.nextIndex);
    }
    return result
  }
}

const batchUploadFileByQManage = new BatchUploadFileByQManage()

/** 让所有的bitable.base.batchUploadFile都排队，避免并发 */
export function batchUploadFileByQ(file: File[] | FileList) {

  return batchUploadFileByQManage.uploadByQ(file);

}

export function clearBatchUploadFileQueue() {
  batchUploadFileQueue = []
}