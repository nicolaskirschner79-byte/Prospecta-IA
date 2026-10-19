import { newBusiness, field } from './domain.js';
export function demoBusinesses() {
  const examples=[
    ['Ateliê Aurora • Fictício','beauty','absent','Serviços e solicitações de horário em um só lugar.',[true,true,true,true,true],true],
    ['Bistrô Horizonte • Fictício','food','social','Organizar cardápio e informações de atendimento.',[true,true,true,true,true],false],
    ['Studio Forma • Fictício','fitness','improvements','Investigar pontos de contato e conteúdo.',[true,true,true,true,false],false],
    ['Casa Nativa • Fictício','furniture','not_found','Verificar presença digital antes da abordagem.',[true,false,true,false,true],false],
    ['Oficina Vetor • Fictício','auto','inconclusive','A identidade digital ainda precisa de confirmação.',[null,null,true,null,null],false],
    ['Clínica Plural • Fictício','health','adequate','Presença adequada nos critérios do cenário de teste.',[true,true,true,true,true],false]
  ];
  return examples.map(([name,segment,digital,description,values,interest],i)=>{
    const b=newBusiness({name,segment,city:'Cidade de demonstração',uf:'SP',district:['Centro','Jardim Exemplo','Vila Modelo'][i%3],description,services:'Serviços de exemplo. Confirmar com a empresa antes de usar em qualquer projeto real.'});
    b.id=`demo-${i+1}`;b.demo=true;b.sources[0].label='Cenário inteiramente fictício';b.sources[0].license='Demonstração sintética';b.sources[0].permissions={retain:true,export:true,ai:true};
    const a=(value,reason)=>({...field('',b.sources[0].id),value,status:'user',reason});
    b.assessments={identity:a(i!==4,'Identidade validada apenas no cenário fictício.'),digital:{...a(digital,'Situação simulada para testar o fluxo.'),sufficient:true},interest:a(interest,interest?'Interesse explícito no cenário de teste.':'Sem interesse registrado no cenário de teste.'),nextStep:a(interest,interest?'Próximo passo combinado no cenário fictício.':'Nenhum próximo passo combinado.'),contactChecked:a(false,'Nenhum contato real é utilizado nesta demonstração.')};
    ['recentActivity','consistentInfo','useCase','informationNeed','benefit'].forEach((k,j)=>{if(values[j]!==null)b.assessments[k]=a(values[j],'Evidência sintética para visualizar o índice.');});
    if(i===2)b.audits=[{at:new Date().toISOString(),permissions:{retain:true,export:true,ai:true},tests:[{id:'title',status:'fail',evidence:'Ausência de título no HTML sintético.'},{id:'contact',status:'fail',evidence:'Contato ausente no HTML sintético.'}]}];
    b.stage=['Novo','Selecionado','Em análise','Proposta enviada','Novo','Em conversa'][i];b.favorite=i===0||i===3;
    return b;
  });
}
