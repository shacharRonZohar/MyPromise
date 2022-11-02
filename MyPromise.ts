namespace Status {
  export const PENDING = 'pending'
  export const FULFILLED = 'fulfilled'
  export const REJECTED = 'rejected'
}

interface MyPromise<T> {
  then<U>(onFulfilled?: (value: T) => U | MyPromise<U>, onRejected?: (error: any) => U | MyPromise<U>): MyPromise<U>
  catch<U>(onRejected?: (error: any) => U | MyPromise<U>): MyPromise<U>
  finally(onFinally?: () => void): MyPromise<T>
  resolve<k>(value: k | MyPromise<k>): MyPromise<k>
  reject<k>(value: k | MyPromise<k>): MyPromise<k>
  all(promises: MyPromise<any>[]): MyPromise<any>
  race(promises: MyPromise<any>[]): MyPromise<any>
  // TODO: add static methods
  any(promises: MyPromise<any>[]): MyPromise<any>
  allSettled(promises: MyPromise<any>[]): MyPromise<any>
}

class MyPromise<T> {
  #status = Status.PENDING
  #value = null as T
  #cbs = {
    then: [] as Function[],
    catch: [] as Function[]
  }

  constructor(handler) {
    try {
      handler(this.#resolveCb.bind(this), this.#rejectCb.bind(this))
    } catch (err) {
      this.#rejectCb(err)
    }
  }

  #resolveCb(val) {
    queueMicrotask(() => {
      if (this.#status !== Status.PENDING) return
      if (val instanceof MyPromise) {
        val.then(this.#resolveCb.bind(this), this.#rejectCb.bind(this))
        return
      }
      this.#status = Status.FULFILLED
      this.#value = val
      this.#runCbs()
    })

  }
  #rejectCb(val) {
    queueMicrotask(() => {
      if (this.#status !== Status.PENDING) return
      if (val instanceof MyPromise) {
        val.then(this.#resolveCb.bind(this), this.#rejectCb.bind(this))
        return
      }
      if (this.#cbs.catch.length === 0) {
        throw new Error('Uncaught in promise: ' + val)
      }
      this.#status = Status.REJECTED
      this.#value = val
      this.#runCbs()
    })
  }
  #runCbs() {
    if (this.#status === Status.FULFILLED) {
      this.#cbs.then.forEach(cb => {
        cb(this.#value)
      })
      this.#cbs.then = []
    }
    if (this.#status === Status.REJECTED) {
      this.#cbs.catch.forEach(cb => {
        cb(this.#value)
      })
      this.#cbs.catch = []
    }
  }
  then(thenCb, catchCb) {
    const funcs = {
      then: thenCb,
      catch: catchCb
    }
    return new MyPromise((resolve, reject) => {
      for (let func in funcs) {
        this.#cbs[func].push((val) => {
          if (!funcs[func]) {
            resolve(val)
            return
          }
          try {
            const res = funcs[func](val)
            if (res instanceof MyPromise) {
              res.then(resolve, reject)
              return
            }
            resolve(res)
          } catch (err) {
            reject(err)
          }
        })
      }
      this.#runCbs()
    })
  }

  catch(cb) {
    return this.then(null, cb)
  }

  finally(cb) {
    return this.then(() => {
      cb()
    }, () => {
      cb()
    })
  }

  static resolve(val) {
    return new MyPromise(resolve => {
      resolve(val)
    })
  }

  static reject(val) {
    return new MyPromise((resolve, reject) => {
      reject(val)
    })
  }

  static race(promises) {
    return new MyPromise((resolve, reject) => {
      promises.forEach(promise => {
        promise
          .then(resolve)
          .catch(reject)
      })
    })
  }

  static all(promises) {
    // Option 1
    // const settledPrms = []
    // return new MyPromise((resolve, reject) => {
    //   promises.forEach((promise, idx) => {
    //     promise.then((val) => {
    //       settledPrms[idx] = val
    //       if (settledPrms.filter(settledPrm => settledPrm).length === promises.length) resolve(settledPrms)
    //     }, reject)
    //   })
    // })

    // Option 2
    //   const testArr = [] as boolean[]
    //   const settledPrms = [] as any[]
    //   return new MyPromise((resolve, reject) => {
    //     promises.forEach((promise, idx) => {
    //       promise.then((val) => {
    //         settledPrms[idx] = val
    //         testArr.push(true)
    //         if (testArr.length === promises.length) resolve(settledPrms)
    //       }, reject)
    //     })
    //   })
    // }

    // Option 3
    let completedPrmsNum = 0
    const settledPrms = [] as any[]
    return new MyPromise((resolve, reject) => {
      promises.forEach((promise, idx) => {
        promise.then((val) => {
          settledPrms[idx] = val
          completedPrmsNum++
          if (completedPrmsNum === promises.length) resolve(settledPrms)
        })
          .catch(reject)
      })
    })
  }
}


module.exports = MyPromise
