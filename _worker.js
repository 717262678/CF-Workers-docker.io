// _worker.js

// Docker镜像仓库主机地址
let hub_host = 'registry-1.docker.io';
// Docker认证服务器地址
const auth_url = 'https://auth.docker.io';

let 屏蔽爬虫UA = ['netcraft'];

// 根据主机名选择对应的上游地址
function routeByHosts(host) {
	// 定义路由表
	const routes = {
		// 生产环境
		"quay": "quay.io",
		"gcr": "gcr.io",
		"k8s-gcr": "k8s.gcr.io",
		"k8s": "registry.k8s.io",
		"ghcr": "ghcr.io",
		"cloudsmith": "docker.cloudsmith.io",
		"nvcr": "nvcr.io",

		// 测试环境
		"test": "registry-1.docker.io",
	};

	if (host in routes) return [routes[host], false];
	else return [hub_host, true];
}

/** @type {RequestInit} */
const PREFLIGHT_INIT = {
	// 预检请求配置
	headers: new Headers({
		'access-control-allow-origin': '*', // 允许所有来源
		'access-control-allow-methods': 'GET,POST,PUT,PATCH,TRACE,DELETE,HEAD,OPTIONS', // 允许的HTTP方法
		'access-control-max-age': '1728000', // 预检请求的缓存时间
	}),
}

/**
 * 构造响应
 * @param {any} body 响应体
 * @param {number} status 响应状态码
 * @param {Object<string, string>} headers 响应头
 */
function makeRes(body, status = 200, headers = {}) {
	headers['access-control-allow-origin'] = '*' // 允许所有来源
	return new Response(body, { status, headers }) // 返回新构造的响应
}

/**
 * 构造新的URL对象
 * @param {string} urlStr URL字符串
 * @param {string} base URL base
 */
function newUrl(urlStr, base) {
	try {
		console.log(`Constructing new URL object with path ${urlStr} and base ${base}`);
		return new URL(urlStr, base); // 尝试构造新的URL对象
	} catch (err) {
		console.error(err);
		return null // 构造失败返回null
	}
}

async function nginx() {
	const text = `
	<!DOCTYPE html>
	<html>
	<head>
	<title>Welcome to nginx!</title>
	<style>
		body {
			width: 35em;
			margin: 0 auto;
			font-family: Tahoma, Verdana, Arial, sans-serif;
		}
	</style>
	</head>
	<body>
	<h1>Welcome to nginx!</h1>
	<p>If you see this page, the nginx web server is successfully installed and
	working. Further configuration is required.</p>
	
	<p>For online documentation and support please refer to
	<a href="http://nginx.org/">nginx.org</a>.<br/>
	Commercial support is available at
	<a href="http://nginx.com/">nginx.com</a>.</p>
	
	<p><em>Thank you for using nginx.</em></p>
	</body>
	</html>
	`
	return text;
}

async function searchInterface() {
	const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<title>Docker Hub 镜像搜索</title>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<style>
		:root {
			--github-color: rgb(27,86,198);
			--github-bg-color: #ffffff;
			--primary-color: #0066ff;
			--primary-dark: #0052cc;
			--gradient-start: #1a90ff;
			--gradient-end: #003eb3;
			--text-color: #ffffff;
			--shadow-color: rgba(0,0,0,0.1);
			--transition-time: 0.3s;
		}
		
		* {
			box-sizing: border-box;
			margin: 0;
			padding: 0;
		}

		body {
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			min-height: 100vh;
			margin: 0;
			background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
			padding: 20px;
			color: var(--text-color);
			overflow-x: hidden;
		}

		.container {
			text-align: center;
			width: 100%;
			max-width: 800px;
			padding: 20px;
			margin: 0 auto;
			display: flex;
			flex-direction: column;
			justify-content: center;
			min-height: 60vh;
			animation: fadeIn 0.8s ease-out;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}

		.github-corner {
			position: fixed;
			top: 0;
			right: 0;
			z-index: 999;
			transition: transform var(--transition-time) ease;
		}
		
		.github-corner:hover {
			transform: scale(1.08);
		}

		.github-corner svg {
			fill: var(--github-bg-color);
			color: var(--github-color);
			position: absolute;
			top: 0;
			border: 0;
			right: 0;
			width: 80px;
			height: 80px;
			filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.2));
		}

		.logo {
			margin-bottom: 20px;
			transition: transform var(--transition-time) ease;
			animation: float 6s ease-in-out infinite;
		}
		
		@keyframes float {
			0%, 100% { transform: translateY(0); }
			50% { transform: translateY(-10px); }
		}
		
		.logo:hover {
			transform: scale(1.08) rotate(5deg);
		}
		
		.logo svg {
			filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.2));
		}
		
		.title {
			color: var(--text-color);
			font-size: 2.3em;
			margin-bottom: 10px;
			text-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
			font-weight: 700;
			letter-spacing: -0.5px;
			animation: slideInFromTop 0.5s ease-out 0.2s both;
		}
		
		@keyframes slideInFromTop {
			from { opacity: 0; transform: translateY(-20px); }
			to { opacity: 1; transform: translateY(0); }
		}
		
		.subtitle {
			color: rgba(255, 255, 255, 0.9);
			font-size: 1.1em;
			margin-bottom: 25px;
			max-width: 600px;
			margin-left: auto;
			margin-right: auto;
			line-height: 1.4;
			animation: slideInFromTop 0.5s ease-out 0.4s both;
		}
		
		.search-container {
			display: flex;
			align-items: stretch;
			width: 100%;
			max-width: 600px;
			margin: 0 auto;
			height: 55px;
			position: relative;
			animation: slideInFromBottom 0.5s ease-out 0.6s both;
			box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
			border-radius: 12px;
			overflow: hidden;
		}
		
		@keyframes slideInFromBottom {
			from { opacity: 0; transform: translateY(20px); }
			to { opacity: 1; transform: translateY(0); }
		}
		
		#search-input {
			flex: 1;
			padding: 0 20px;
			font-size: 16px;
			border: none;
			outline: none;
			transition: all var(--transition-time) ease;
			height: 100%;
		}
		
		#search-input:focus {
			padding-left: 25px;
		}
		
		#search-button {
			width: 60px;
			background-color: var(--primary-color);
			border: none;
			cursor: pointer;
			transition: all var(--transition-time) ease;
			height: 100%;
			display: flex;
			align-items: center;
			justify-content: center;
			position: relative;
		}
		
		#search-button svg {
			transition: transform 0.3s ease;
			stroke: white;
		}
		
		#search-button:hover {
			background-color: var(--primary-dark);
		}
		
		#search-button:hover svg {
			transform: translateX(2px);
		}
		
		#search-button:active svg {
			transform: translateX(4px);
		}
		
		.tips {
			color: rgba(255, 255, 255, 0.8);
			margin-top: 20px;
			font-size: 0.9em;
			animation: fadeIn 0.5s ease-out 0.8s both;
			transition: transform var(--transition-time) ease;
		}
		
		.tips:hover {
			transform: translateY(-2px);
		}
		
		@media (max-width: 768px) {
			.container {
				padding: 20px 15px;
				min-height: 60vh;
			}
			
			.title {
				font-size: 2em;
			}
			
			.subtitle {
				font-size: 1em;
				margin-bottom: 20px;
			}
			
			.search-container {
				height: 50px;
			}
		}
		
		@media (max-width: 480px) {
			.container {
				padding: 15px 10px;
				min-height: 60vh
