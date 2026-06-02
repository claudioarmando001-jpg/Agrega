// Canais de Notícias de Moçambique convertidos de RSS para JSON (contorna o bloqueio de CORS)
const FONTES_NOTICIAS = [
    { nome: "O País", url: "https://api.rss2json.com/v1/api.json?rss_url=https://opais.co.mz/feed/" },
    { nome: "Club of Mozambique", url: "https://api.rss2json.com/v1/api.json?rss_url=https://clubofmozambique.com/feed/" },
    { nome: "Jornal Verdade", url: "https://api.rss2json.com/v1/api.json?rss_url=http://www.verdade.co.mz/feed/" }
];

let baseNoticias = [];

// Carrega os dados das fontes externas para a memória
async function carregarDadosNoticias() {
    try {
        const promessas = FONTES_NOTICIAS.map(fonte => 
            fetch(fonte.url)
                .then(res => res.json())
                .then(dados => {
                    if (dados.status === 'ok') {
                        return dados.items.map(item => ({
                            id: btoa(encodeURIComponent(item.link)).substring(0, 20), // ID seguro por Link
                            titulo: item.title,
                            conteudo: item.description || item.content,
                            linkOriginal: item.link,
                            data: new Date(item.pubDate).toLocaleDateString('pt-MZ'),
                            fonte: fonte.nome,
                            imagem: item.enclosure?.link || item.thumbnail || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600'
                        }));
                    }
                    return [];
                }).catch(() => [])
        );

        const resultados = await Promise.all(promessas);
        baseNoticias = resultados.flat();
        
        // Ordenação misturada para dar dinamismo
        baseNoticias.sort((a, b) => 0.5 - Math.random());
    } catch (e) {
        console.error("Erro na recolha de dados:", e);
    }
}

// Renderizar o Feed (Executado apenas na index.html)
function renderizarGridHome() {
    const grid = document.getElementById("grid-noticias");
    if (!grid) return;
    grid.innerHTML = "";

    if (baseNoticias.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-12 text-red-500">Não foi possível carregar as notícias. Tente atualizar.</div>`;
        return;
    }

    baseNoticias.forEach(noticia => {
        const cartao = document.createElement("div");
        cartao.className = "bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition flex flex-col justify-between cursor-pointer";
        
        // Redireciona para a SEGUNDA PÁGINA fisicamente passando o ID na URL
        cartao.onclick = () => {
            window.location.href = `ler.html?id=${noticia.id}`;
        };

        cartao.innerHTML = `
            <div>
                <img src="${noticia.imagem}" alt="" class="w-full h-48 object-cover bg-gray-200">
                <div class="p-4">
                    <div class="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <span class="bg-red-50 text-red-700 font-semibold px-2 py-0.5 rounded">${noticia.fonte}</span>
                        <span>${noticia.data}</span>
                    </div>
                    <h3 class="font-bold text-gray-900 line-clamp-3 hover:text-red-700 transition">${noticia.titulo}</h3>
                </div>
            </div>
            <div class="p-4 pt-0 text-xs text-red-700 font-medium flex items-center gap-1">
                Abrir notícia completa <i data-lucide="chevron-right" class="w-3 h-3"></i>
            </div>
        `;
        grid.appendChild(cartao);
    });
}

// Renderizar Leitura e Relacionadas (Executado apenas na ler.html)
function renderizarPaginaLeitura() {
    const params = new URLSearchParams(window.location.search);
    const idNoticia = params.get('id');
    
    if (!idNoticia) {
        window.location.href = 'index.html';
        return;
    }

    const noticia = baseNoticias.find(n => n.id === idNoticia);

    if (!noticia) {
        document.getElementById("artigo-titulo").innerText = "Notícia não encontrada ou expirada.";
        return;
    }

    // Injetar dados da notícia
    document.getElementById("artigo-titulo").innerText = noticia.titulo;
    document.getElementById("artigo-fonte").innerText = noticia.fonte;
    document.getElementById("artigo-data").innerText = noticia.data;
    document.getElementById("artigo-conteudo").innerHTML = noticia.conteudo;
    document.getElementById("artigo-link-original").href = noticia.linkOriginal;

    // Gerar Bloco de Relacionadas (Notícias do mesmo canal ou aleatórias)
    const filtradasRelacionadas = baseNoticias
        .filter(n => n.id !== noticia.id)
        .slice(0, 5);

    const abaRelacionadas = document.getElementById("lista-relacionadas");
    abaRelacionadas.innerHTML = "";

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

// Partilhar link gerado que aponta diretamente para a segunda página
function partilharNoticiaLink() {
    const linkParaPartilha = window.location.href; // Captura o link completo com o id da ler.html

    if (navigator.share) {
        navigator.share({
            title: document.getElementById("artigo-titulo").innerText,
            url: linkParaPartilha
        }).catch(console.error);
    } else {
        navigator.clipboard.writeText(linkParaPartilha).then(() => {
            const aviso = document.getElementById("aviso-copiado");
            aviso.classList.remove("hidden");
            setTimeout(() => aviso.classList.add("hidden"), 2500);
        });
    }
}
