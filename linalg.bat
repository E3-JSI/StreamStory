call node-gyp clean
call node-gyp configure --nodedir="D:/work/code/cpp/node-v0.12.0" -- -DLIN_ALG_BLAS=BLAS -DLIN_ALG_LAPACKE=LAPACKE -DLIN_ALG_INCLUDE="D:/work/code/cpp/openblas/include" -DLIN_ALG_LIB="D:/work/code/cpp/openblas/lib/libopenblas.dll.a"
call node-gyp build
call node -e "var la = require('./indexRelease.js').la;var A = new la.Matrix({ rows: 1000, cols: 1000, random: true });var B = new la.Matrix({ rows: 1000, cols: 1000, random: true });console.time('Multiply'); var C = A.multiply(B); console.timeEnd('Multiply');"