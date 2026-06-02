// Canais de Notícias de Moçambique (RSS Originais)
const FONTES_NOTICIAS = [
    { nome: "O País", url: "https://opais.co.mz/feed/" },
    { nome: "Club of Mozambique", url: "https://clubofmozambique.com/feed/" },
    { nome: "Jornal Verdade", url: "http://www.verdade.co.mz/feed/" }
];

// Proxy público para contornar o bloqueio de CORS no GitHub Pages
const PROXY_CORS = "https://api.allorigins.win/get?url=";

let baseNoticias = [];

// Função auxiliar para gerar um ID numérico simples e seguro a partir do link
function gerarId(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

// Função para extrair texto de dentro de tags HTML (limpa o feed)
function limparResumo(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

// O MOTOR PRINCIPAL: Procura e processa as notícias
async function carregarDadosNoticias() {
    // Se já temos no localStorage, carrega imediatamente para evitar ecrã em branco
    const salvas = localStorage.getItem('feed_noticias');
    if (salvas) {
        baseNoticias = JSON.parse(salvas);
    }

    try {
        let novasNoticias = [];

        for (const fonte of FONTES_NOTICIAS) {
            try {
                // Faz o fetch através do proxy AllOrigins
                const resposta = await fetch(`${PROXY_CORS}${encodeURIComponent(fonte.url)}`);
                const dadosJson = await resposta.json();
                
                // AllOrigins devolve o XML como uma string dentro do campo 'contents'
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(dadosJson.contents, "text/xml");
                const items = xmlDoc.querySelectorAll("item");

                items.forEach(item => {
                    const titulo = item.querySelector("title")?.textContent || "";
                    const linkOriginal = item.querySelector("link")?.textContent || "";
                    const rawConteudo = item.querySelector("description")?.textContent || item.querySelector("encoded")?.textContent || "";
                    const pubDate = item.querySelector("pubDate")?.textContent || "";
                    
                    // Tenta apanhar uma imagem do feed
                    let imagem = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600';
                    const mediaContent = item.getElementsByTagName("media:content")[0];
                    const enclosure = item.querySelector("enclosure");
                    if (mediaContent) imagem = mediaContent.getAttribute("url");
                    else if (enclosure) imagem = enclosure.getAttribute("url");

                    if (titulo && linkOriginal) {
                        novasNoticias.push({
                            id: gerarId(linkOriginal),
                            titulo: titulo,
                            conteudo: rawConteudo, // Mantém o HTML para a página de leitura
                            resumo: limparResumo(rawConteudo).substring(0, 150) + "...",
                            linkOriginal: linkOriginal,
                            data: pubDate ? new Date(pubDate).toLocaleDateString('pt-MZ') : new Date().toLocaleDateString('pt-MZ'),
                            fonte: fonte.nome,
                            imagem: imagem
                        });
                    }
                });
            } catch (erroFonte) {
                console.warn(`Não foi possível carregar a fonte ${fonte.nome}:`, erroFonte);
            }
        }

        if (novasNoticias.length > 0) {
            // Ordena por data (as mais recentes primeiro)
            baseNoticias = novasNoticias.sort((a, b) => new Date(b.data) - new Date(a.data));
            // Guarda no localStorage para partilhar entre a index e a ler.html
            localStorage.setItem('feed_noticias', JSON.stringify(baseNoticias));
        }
    } catch (e) {
        console.error("Erro geral na recolha de dados:", e);
    }
}

// RENDERIZAR O FEED (Executado na index.html)
function renderizarGridHome() {
    const grid = document.getElementById("grid-noticias");
    if (!grid) return;
    grid.innerHTML = "";

    if (baseNoticias.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-red-500 font-medium">Nenhuma notícia encontrada no momento.</p>
                <button onclick="window.location.reload()" class="mt-4 bg-red-700 text-white px-4 py-2 rounded-lg text-sm">Tentar Novamente</button>
            </div>`;
        return;
    }

    baseNoticias.forEach(noticia => {
        const cartao = document.createElement("div");
        cartao.className = "bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col justify-between cursor-pointer";
        
        cartao.onclick = () => {
            window.location.href = `ler.html?id=${noticia.id}`;
        };

        cartao.innerHTML = `
            <div>
                <img src="${noticia.imagem}" alt="" class="w-full h-48 object-cover bg-gray-200" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600'">
                <div class="p-4">
                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span class="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded">${noticia.fonte}</span>
                        <span>${noticia.data}</span>
                    </div>
                    <h3 class="font-bold text-gray-900 line-clamp-2 hover:text-red-700 transition mb-2">${noticia.titulo}</h3>
                    <p class="text-gray-600 text-xs line-clamp-3">${noticia.resumo}</p>
                </div>
            </div>
            <div class="p-4 pt-0 text-xs text-red-700 font-medium flex items-center gap-1">
                Abrir notícia completa <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </div>
        `;
        grid.appendChild(cartao);
    });
}

// RENDERIZAR LEITURA (Executado na ler.html)
function renderizarPaginaLeitura() {
    const params = new URLSearchParams(window.location.search);
    const idNoticia = params.get('id');
    
    if (!idNoticia) {
        window.location.href = 'index.html';
        return;
    }

    const noticia = baseNoticias.find(n => n.id === idNoticia);

    if (!noticia) {
        document.getElementById("artigo-titulo").innerText = "Notícia em carregamento ou não encontrada...";
        // Se não achou de primeira, espera 1 segundo e tenta de novo (caso o fetch demore)
        setTimeout(renderizarPaginaLeitura, 1500);
        return;
    }

    // Injetar dados
    document.getElementById("artigo-titulo").innerText = noticia.titulo;
    document.getElementById("artigo-fonte").innerText = noticia.fonte;
    document.getElementById("artigo-data").innerText = noticia.data;
    
    // Insere o conteúdo (limpa inline styles agressivos para manter o visual limpo do agregador)
    const conteudoLimpo = noticia.conteudo.replace(/style="[^"]*"/g, "");
    document.getElementById("artigo-conteudo").innerHTML = conteudoLimpo;
    document.getElementById("artigo-link-original").href = noticia.linkOriginal;

    // Gerar Bloco de Relacionadas (Filtra a atual e pega outras 4)
    const filtradasRelacionadas = baseNoticias
        .filter(n => n.id !== noticia.id)
        .slice(0, 4);

    const abaRelacionadas = document.getElementById("lista-relacionadas");
    abaRelacionadas.innerHTML = "";

    if (filtradasRelacionadas.length === 0) {
        abaRelacionadas.innerHTML = "<p class='text-xs text-gray-400'>Sem notícias relacionadas no momento.</p>";
    }

    filtradasRelacionadas.forEach(rel => {
        const item = document.createElement("div");
        item.className = "group cursor-pointer border-b border-gray-100 pb-3 last:border-0 hover:bg-gray-50 p-1 rounded transition";
        item.onclick = () => {
            window.location.href = `ler.html?id=${rel.id}`;
        };
        item.innerHTML = `
            <p class="text-xs text-red-600 font-semibold mb-0.5">${rel.fonte}</p>
            <h4 class="text-sm font-medium text-gray-800 group-hover:text-red-700 transition line-clamp-2">${rel.titulo}</h4>
        `;
        abaRelacionadas.appendChild(item);
    });
}

// Função de Partilha
function partilharNoticiaLink() {
    const linkParaPartilha = window.location.href;

    if (navigator.share) {
        navigator.share({
            title: document.getElementById("artigo-titulo").innerText,
            url: linkParaPartilha
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(linkParaPartilha).then(() => {
            const aviso = document.getElementById("aviso-copiado");
            if(aviso) {
                aviso.classList.remove("hidden");
                setTimeout(() => aviso.classList.add("hidden"), 2500);
            }
        });
    }
}
