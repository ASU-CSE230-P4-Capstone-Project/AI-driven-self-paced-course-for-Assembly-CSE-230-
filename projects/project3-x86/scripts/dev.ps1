# build rust → wasm
pushd core
wasm-pack build --target web --release --out-dir ../frontend/src/wasm/pkg --out-name web_x86_core
popd
# start vite
pushd frontend
npm run dev
popd       