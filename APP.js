// Configuração das APIs REST do WordPress dos portais de Moçambique
const FONTES_WP = [
    { 
        nome: "O País", 
        url: "https://opais.co.mz/wp-json/wp/v2/posts?per_page=10&_embed" 
    },
    { 
        nome: "Jornal Verdade", 
        url: "http://www.verdade.co.mz/wp-json/wp/v2/posts?per_page=10&_embed" 
    },
    { 
        nome: "Club of Mozambique", 
        url: "https://clubofmozambique.com/wp-json/wp/v2/posts?per_page=10&_embed" 
    }
];

// Proxy ultra-rápido para evitar Bloqueio de CORS no GitHub Pages
const PROXY_CORS = "https://api.allorigins.win/get?url=";

let baseNoticias = [];

// Função para limpar tags HTML do resumo
function limparTags(html) {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
}

// MOTOR PRINCIPAL: Procura as notícias através da API do WordPress
async function carregarDadosNoticias() {
    // 1. Tentar carregar dados imediatamente do cache local (evita ecrã em branco)
    const salvas = localStorage.getItem('feed_noticias_wp');
    if (salvas) {
        baseNoticias = JSON.parse(salvas);
    }

    let novasNoticias = [];

    // 2. Fazer a requisição para cada API
    for (const fonte of FONTES_WP) {
        try {
            // Construir URL final com o Proxy para contornar o CORS
            const urlFinal = `${PROXY_CORS}${encodeURIComponent(fonte.url)}`;
            const resposta = await fetch(urlFinal);
            const jsonGeral = await resposta.json();
            
            // O AllOrigins encapsula a resposta real dentro do campo 'contents' como string
            const posts = JSON.parse(jsonGeral.contents);

            if (Array.isArray(posts)) {
                posts.forEach(post => {
                    // Tentar extrair a imagem em destaque (Featured Image) via _embed do WP
                    let imagem = 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600';
                    try {
                        const emDestaque = post._embedded?.['wp:featuredmedia']?.[0];
                        if (emDestaque && emDestaque.source_url) {
                            imagem = emDestaque.source_url;
                        }
                    } catch (e) { console.log("Sem imagem em destaque neste post"); }

                    novasNoticias.push({
                        id: post.id.toString(), // O próprio ID único do WordPress
                        titulo: post.title?.rendered || "Sem título",
                        conteudo: post.content?.rendered || "",
                        resumo: limparTags(post.excerpt?.rendered || post.content?.rendered || "").substring(0, 140) + "...",
                        linkOriginal: post.link,
                        data: new Date(post.date).toLocaleDateString('pt-MZ'),
                        timestamp: new Date(post.date).getTime(),
                        fonte: fonte.nome,
                        imagem: imagem
                    });
                });
            }
        } catch (erro) {
            console.warn(`Falha ao conectar com a API WP de: ${fonte.nome}. Ignorando...`);
        }
    }

    // 3. Organizar e salvar os resultados se encontrámos notícias
    if (novasNoticias.length > 0) {
        // Ordenar por data mais recente (Timestamp decrescente)
        baseNoticias = novasNoticias.sort((a, b) => b.timestamp - a.timestamp);
        localStorage.setItem('feed_noticias_wp', JSON.stringify(baseNoticias));
    }
}

// ==========================================
// RENDERIZAR O FEED PRINCIPAL (index.html)
// ==========================================
function renderizarGridHome() {
    const grid = document.getElementById("grid-noticias");
    if (!grid) return;
    grid.innerHTML = "";

    if (baseNoticias.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-12">
                <p class="text-gray-500 font-medium">A sincronizar com os servidores de Moçambique...</p>
                <p class="text-xs text-gray-400 mt-1">Se demorar, por favor clique no botão abaixo.</p>
                <button onclick="recarregarFeed()" class="mt-4 bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-sm transition">
                    Forçar Atualização
                </button>
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
                <div class="relative h-48 bg-gray-100">
                    <img src="${noticia.imagem}" alt="" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600'">
                </div>
                <div class="p-4">
                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span class="bg-red-50 text-red-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase">${noticia.fonte}</span>
                        <span>${noticia.data}</span>
                    </div>
                    <h3 class="font-bold text-gray-900 line-clamp-2 hover:text-red-700 transition text-base mb-2 leading-snug">${noticia.titulo}</h3>
                    <p class="text-gray-600 text-xs line-clamp-3 leading-relaxed">${noticia.resumo}</p>
                </div>
            </div>
            <div class="p-4 pt-0 text-xs text-red-700 font-semibold flex items-center gap-1">
                Ler notícia completa <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </div>
        `;
        grid.appendChild(cartao);
    });
}

// Auxiliary para o botão de atualizar
async function recarregarFeed() {
    localStorage.removeItem('feed_noticias_wp');
    window.location.reload();
}

// ==========================================
// RENDERIZAR PÁGINA DE LEITURA (ler.html)
// ==========================================
function renderizarPaginaLeitura() {
    const params = new URLSearchParams(window.location.search);
    const idNoticia = params.get('id');
    
    if (!idNoticia) {
        window.location.href = 'index.html';
        return;
    }

    const noticia = baseNoticias.find(n => n.id === idNoticia);

    if (!noticia) {
        document.getElementById("artigo-titulo").innerText = "A procurar artigo no banco de dados...";
        // Tenta re-renderizar caso o fetch em segundo plano termine
        setTimeout(renderizarPaginaLeitura, 1000);
        return;
    }

    // Injetar os dados na tela de leitura
    document.getElementById("artigo-titulo").innerHTML = noticia.titulo;
    document.getElementById("artigo-fonte").innerText = noticia.fonte;
    document.getElementById("artigo-data").innerText = noticia.data;
    
    // Limpar estilos inline do WordPress que quebram o layout mobile
    const conteudoFormatado = noticia.conteudo.replace(/style="[^"]*"/g, "");
    document.getElementById("artigo-conteudo").innerHTML = conteudoFormatado;
    document.getElementById("artigo-link-original").href = noticia.linkOriginal;

    // GERAR ABA DE RELACIONADAS (Pega 4 notícias do feed, excluindo a atual)
    const filtradasRelacionadas = baseNoticias
        .filter(n => n.id !== noticia.id)
        .slice(0, 4);

    const abaRelacionadas = document.getElementById("lista-relacionadas");
    abaRelacionadas.innerHTML = "";

    if (filtradasRelacionadas.length === 0) {
        abaRelacionadas.innerHTML = "<p class='text-xs text-gray-400 p-2'>Sem mais notícias no momento.</p>";
    }

    filtradasRelacionadas.forEach(rel => {
        const item = document.createElement("div");
        item.className = "group cursor-pointer border-b border-gray-100 pb-3 last:border-0 hover:bg-gray-50 p-1.5 rounded transition";
        item.onclick = () => {
            window.location.href = `ler.html?id=${rel.id}`;
        };
        item.innerHTML = `
            <p class="text-[10px] text-red-600 font-bold uppercase mb-0.5">${rel.fonte}</p>
            <h4 class="text-sm font-medium text-gray-800 group-hover:text-red-700 transition line-clamp-2">${rel.titulo}</h4>
        `;
        abaRelacionadas.appendChild(item);
    });
}

// ==========================================
// SISTEMA DE PARTILHA POR LINK
// ==========================================
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
