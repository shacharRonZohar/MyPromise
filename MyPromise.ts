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
    // queueMicrotask(() => {
    try {
      handler(this.#resolveCb.bind(this), this.#rejectCb.bind(this))
    } catch (err) {
      this.#rejectCb(err)
    }
    // })
  }

  // }
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
timeTests()
// runTests()
function timeTests() {
  // These are tests ment to test the runtime of the handler function and the async nature of the promise,
  // not the correctness of the implementation
  // These tests are not meant to be run with the other tests
  // They were the determinig factor in the implementation of the promise, in terms of where to queue the microtasks
  // and how to handle the async nature of the promise
  // They were left here for reference
  console.time('promise')
  new Promise((resolve, reject) => {
    for (let i = 0; i < 1000000000; i++) {
      i++
    }
    resolve(1)
  })
    .then((val) => {
      console.log(val)
    })
  console.timeEnd('promise')

  console.time('myPromise')
  new MyPromise((resolve, reject) => {
    for (let i = 0; i < 1000000000; i++) {
      i++
    }
    resolve(0)
  }).then((val) => {
    console.log(val)
  })
  console.timeEnd('myPromise')

}
console.log('after all')

function runTests() {

  {
    const prm = new MyPromise<string>((resolve, reject) => {
      setTimeout(() => {
        resolve('hi')
      }, 1000)
    })
    prm.then((v) => {
      console.log('from then:', v)
      return v + 1
    })
      .then((v) => {
        console.log('from then1:', v)
        return v + 1
      })
      .then(console.log)
      .catch((v) => {
        console.log(v, 'caught')
        return v
      })
      .finally(() => {
        console.log('finally')
      })
      .finally(() => {
        console.log('finally2')
      })
  }
  {

    new MyPromise<string>((resolve, reject) => {
      setTimeout(() => {
        reject('hi reject')
      }, 1000)
    })
      .then((v) => {
        console.log('from then:', v)
        return v + 1
      })
      .then((v) => {
        console.log('from then1:', v)
        return v + 1
      })
      .then(console.log)
      .catch((v) => {
        console.log(v, 'caught')
        return v
      })
      .finally(() => {
        console.log('finally')
      })
      .finally(() => {
        console.log('finally2')
      })

  }
  makePrms3()
  awaitTest()
  MyPromise.resolve(1)
    .then(console.log)

  MyPromise.reject(0)
    .catch(console.log)
}


// makePrms()
// function makePrms() {
//   const prms = []
//   for (let i = 10; i >= 0; i--) {
//     prms.push(new MyPromise((resolve, reject) => {
//       console.log(i)
//       setTimeout(() => {
//         const msg = `This is promise ${i}`
//         resolve(msg)
//       }, 1000 + i * 100)
//     }))
//   }
//   Promise.race(prms).then(console.log)
// }

// makePrms2()
// Make the same promises from makePrms without a loop
// function makePrms2() {
//   const prms = []
//   prms.push(new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//       const msg = `This is MyPromise ${5}`
//       resolve(msg)
//     }, 1000 + 5 * 100)
//   }))
//   prms.push(new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//       const msg = `This is MyPromise ${1}`
//       resolve(msg)
//     }, 1000 + 1 * 100)
//   }))
//   prms.push(new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//       const msg = `This is MyPromise ${4}`
//       resolve(msg)
//     }, 1000 + 4 * 100)
//   }))
//   prms.push(new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//       const msg = `This is MyPromise ${7}`
//       resolve(msg)
//     }, 1000 + 7 * 100)
//   }))
//   prms.push(new MyPromise((resolve, reject) => {
//     setTimeout(() => {
//       const msg = `This is MyPromise ${6}`
//       resolve(msg)
//     }, 1000 + 6 * 100)
//   }))
//   // console.log(prms)
//   MyPromise.all(prms).then(console.log).catch(console.log)
// }



function makePrms3() {
  // Make the same promises as before but without a timeout in a loop
  const prms = []
  prms.push(new MyPromise((resolve, reject) => {
    const msg = `This is promise ${11}`
    setTimeout(() => {
      resolve(msg)
    }, 2000)
  }))
  for (let i = 0; i < 10; i++) {
    prms.push(new MyPromise((resolve, reject) => {
      // console.log(i)
      const msg = `This is promise ${i}`
      resolve(msg)
    }))
  }
  prms.push(new MyPromise((resolve, reject) => {
    const msg = `This is promise ${10}`
    setTimeout(() => {
      resolve(msg)
    }, 1000)
  }))
  MyPromise.all(prms).then(console.log).catch(console.log)
}

async function awaitTest() {
  const prm = new MyPromise((resolve, reject) => {
    setTimeout(() => {
      resolve('I am from await')
    }, 5000)
  })
  const res = await (prm as unknown as Promise<any>)
  console.log(res)
}